# Agent access

Let coding agents such as Claude Code, Codex, and OpenCode search, read, save to, and organize a Keepall library. The library stays in the browser's IndexedDB. Keepall's servers can't read it, can't read the agent's requests, and can't send commands to it.

Status: proposal, November 15, 2026. Nothing is implemented. A spike decides whether to continue (see [Spike](#spike)).

## Constraints

- No installer, native app, or background service on the user's machine. The agent starts one npm package with `npx`, which needs Node.js 20 or newer.
- No library on the filesystem. IndexedDB through Dexie remains the only working store.
- The relay stores no library content and only ever sees ciphertext.
- The relay runs on the Cloudflare Workers Free plan at $0. The app stays on Vercel unchanged.
- No sync and no server-side copy of the library. `AGENTS.md` does not authorize sync.

Out of scope for this work: chat apps that can only connect to a remote URL (claude.ai, ChatGPT), because they would need a relay that can read requests. Also out: reading the library while Chrome is closed, semantic search, and a native messaging host.

## How it works

```
agent (Claude Code, Codex, OpenCode)
   │  MCP over stdin/stdout
npx @keepall/mcp            encrypts and decrypts, holds the pairing key
   │  WebSocket, encrypted frames
Cloudflare relay            Worker + one Durable Object per library, forwards frames
   │  WebSocket, encrypted frames
extension background worker → offscreen page → /extension-bridge → src/persistence → IndexedDB
```

The browser side reuses the existing extension bridge. `extension/offscreen.js` already loads a hidden `/extension-bridge` iframe that opens the library without a Keepall tab. The bridge advertises features (`file-transfer-v1`, `link-screenshot-v1`). Agent access adds `agent-v1` and routes each request to functions that already exist in `src/persistence` and `src/domain/search.ts`. It needs no new data layer.

### `@keepall/mcp`

A small Node package that the agent launches as a stdio MCP server. It lives only as long as the agent session. It connects to the relay when the agent makes a call and disconnects after about a minute with no calls. It encrypts every request and decrypts every result, so plaintext exists only on the user's machine and in the user's browser.

The package keeps one piece of local state, the pairing key, in a single file readable only by the user (`~/.config/keepall/agent.json` or the platform equivalent). Setting `KEEPALL_AGENT_KEY` in the MCP config replaces the file.

Setup is one entry in the agent's MCP config, pinned to a major version:

```json
{ "keepall": { "command": "npx", "args": ["-y", "@keepall/mcp@1"] } }
```

### Relay

A Cloudflare Worker routes each connection to a Durable Object for that library, using the SQLite storage backend, which is the only one on the Free plan. The Durable Object accepts both WebSockets with the hibernation API and passes frames from one side to the other. It never parses, stores, or logs frame contents.

The relay stores, per library, a random channel ID, hashed connection tokens for each paired agent and browser, the extension's push subscription, and the sealed write queue. It can see when a library connects, how often, and how large the frames are.

### Waking the browser

Nothing stays connected while idle. When an agent's frame arrives and no browser is connected, the Durable Object sends a Web Push message to the extension. The extension's background worker wakes, connects, handles frames, and disconnects after about a minute without traffic.

A permanent connection does not fit the free plan. Chrome keeps an extension's background worker alive only if messages pass at least every 30 seconds. Pings from the extension count as billed requests. Pings from the relay need a timer, and a timer keeps the Durable Object awake, which uses most of the day's free duration for a single user.

## Pairing and encryption

1. On first use, `@keepall/mcp` creates an X25519 key pair and a random 128-bit pairing secret. It prints a link such as `https://www.keepall.app/connect#v=1&k=<public key>&s=<secret>&c=<pairing id>`.
2. The user opens the link in the Chrome profile that holds their library. Browsers never send the part after `#` to a server, so neither Vercel nor the relay sees the key or the secret.
3. The connect page shows which agent is asking and the requested permission level. On approval it creates or loads the library's key pair and sends its public key through the relay under the pairing ID.
4. Both sides derive the session key with HKDF over the X25519 shared secret and the pairing secret. The relay never sees the pairing secret, so it can't substitute its own key in the middle.
5. Frames use AES-256-GCM with a per-direction counter. Each side rejects replayed, reordered, or forged frames. A compromised relay can drop traffic but can't read it or issue commands.

Settings lists paired agents with their permission level and last use. Revoking one deletes its key in the browser and its token at the relay.

## Tools

| Tool | Behavior |
| --- | --- |
| `search_items` | Query, type, collection, tag, limit. Returns IDs, titles, types, and excerpts using the library's existing search rules. |
| `get_item` | One item as Markdown with its note, tags, collection, and source URL. Article and document text on request. Images only on request, in chunks. |
| `list_collections`, `list_tags` | Names, IDs, and item counts. |
| `save_link`, `save_note` | Create or reuse items. New items land in Unsorted and record which agent created them. |
| `organize` | Move items to a collection, add or remove tags. Returns a proposal first unless the agent has permission to apply changes directly. |
| `trash_item` | Moves to Trash. The tools never delete permanently or empty Trash. |
| `export_context_pack` | Returns a collection, tag, or search as the existing context pack format (`src/domain/context-pack.ts`). |

Permission levels are read, read and add, and read, add, and organize. Each write can also require approval in the browser, where the extension's existing toast shows Approve and Deny while the agent waits.

Saved pages are untrusted text. Results mark library content as data, and context packs keep their existing filter that drops agent instruction files such as `CLAUDE.md`.

Each Chrome profile and site origin has its own library, so the library is chosen at pairing. The extension's configured library address is the default.

## When the browser is offline

Reads fail with a clear error: "Keepall isn't reachable. Open Chrome with the Keepall extension and try again."

Writes can go to a sealed queue. `@keepall/mcp` encrypts the write with the library's public key before sending it, so the relay stores only ciphertext it can't open. The extension applies queued writes through the same persistence functions on its next connection and reports a receipt to the agent the next time it connects. The queue holds at most 100 writes per library for 7 days.

## Free plan budget

Figures from Cloudflare's Workers and Durable Objects pricing and limits pages, last updated November 13, 2026. Daily limits reset at midnight UTC. Exceeding one returns errors (Error 1027 for Workers). The docs describe no charges on the free plan, and the account must never subscribe to Workers Paid.

| Limit (per day) | Free | Use per burst of agent calls |
| --- | --- | --- |
| Worker requests | 100,000 | 2 (agent connects, browser connects) |
| Durable Object requests | 100,000 | 2, plus 1 per 20 incoming messages. Outgoing messages are free. |
| Durable Object duration | 13,000 GB-s, about 28 hours of one 128 MB object | Only while handling a frame. Hibernated objects aren't billed. |
| CPU per request | 10 ms | Under 1 ms. The relay forwards bytes and does no crypto. |
| Storage | 5 GB total, 100,000 rows written | Tokens, push subscriptions, sealed queue |
| Egress | Not billed | |

A heavy user with 20 sessions of 10 calls a day uses about 40 Worker requests and 60 Durable Object requests. The free plan covers roughly 1,600 such users a day.

Rules that keep it there:

- The Durable Object never awaits the other side. It forwards each frame when it arrives and returns, so it can hibernate between frames. `@keepall/mcp` owns request timeouts.
- No timers or alarms, except a cleanup alarm while the sealed queue is non-empty.
- The Worker rejects connections without a valid token before they reach a Durable Object.
- Per-library rate limits and a frame size cap. Durable Objects accept received messages up to 32 MiB. Larger results go in chunks.
- The relay uses the free `workers.dev` subdomain, so `keepall.app` DNS stays where it is.

The main risk is abuse that exhausts the daily quota. Agent access would stop for everyone until midnight UTC. Libraries are unaffected.

## Trust

The promise is "Keepall's servers can't read your library or your agents' requests, and can't send commands to it." To make it checkable:

- Open-source the relay and `@keepall/mcp` in this repository.
- Publish `@keepall/mcp` with npm provenance, so anyone can confirm the package was built from the public source.
- Keep its dependencies minimal. Node's built-in `crypto` covers X25519, HKDF, and AES-GCM.
- The setup snippet pins a major version.

The agent's model provider sees whatever the agent reads. The user chose that provider, and the help page should say so.

## Spike

These claims are unverified. The spike answers them before any slice ships.

| Question | Pass condition |
| --- | --- |
| Can an extension receive Web Push without showing a notification? | Push wakes the background worker in Chrome 116+ (or a newer minimum we accept) with no notification. If not, fall back to extension pings while connected, which caps the free plan at about 460 always-connected users. |
| Do push and the relay connection add manifest permissions that trigger Chrome's re-consent prompt for existing users? | No prompt, or the permission can be optional and requested from Settings. |
| Does the offscreen bridge stay usable for a burst of calls after a push wake? | First call answers in under 3 s, later calls under 300 ms. |
| Does WebCrypto in the extension and bridge support X25519? | Works at the chosen minimum Chrome version. |
| Real Cloudflare usage | One day of scripted use shows request and duration counts that match the budget above. |
| The Durable Object CPU and per-object storage limits | The docs contradict themselves (30 s or 10 ms CPU, 10 GB or 1 GB storage). Measure. |
| Do Claude Code, Codex, and OpenCode start `npx -y @keepall/mcp@1` from their MCP config? | Each one lists the tools and completes `search_items`. |

Spike scope: a Worker and Durable Object that forward opaque frames, a minimal `@keepall/mcp` with pairing, and the extension answering `search_items` through `/extension-bridge`.

## Slices after the spike

1. Read tools: `search_items`, `get_item`, `list_collections`, `list_tags`, `export_context_pack`. Pairing, revocation, and the paired agents list in Settings.
2. Writes with provenance: `save_link`, `save_note`, `trash_item`, items from agents marked in Unsorted, optional approval in the browser.
3. `organize` with proposals, using the existing organization preview.
4. Sealed write queue for offline writes.
5. Help page, extension store listing, and privacy page updates describing exactly what the relay can and can't see.
