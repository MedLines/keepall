# Agent access

Let coding agents such as Claude Code, Codex, and OpenCode search, read, save to, and organize a Keepall library. The library stays in the browser's IndexedDB. Keepall's servers can't read it, can't read the agent's requests, and can't send commands to it.

Status: spike built locally on November 15, 2026 (see [Spike results](#spike-results)). Nothing is deployed or published.

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

Read tools, built in the spike:

| Tool | Behavior |
| --- | --- |
| `search_items` | Query plus optional type, collection name, tag name, and `has_images`. Uses the library's own search rules, including text found inside images. Each result has its ID, title, excerpt, tags, collection, picture count, and a link to open it in Keepall. |
| `get_item` | One item in full: note, caption, saved article or document text, text found in its images, palette, tags, and collection. Long text is cut at 30,000 characters and marked as cut. Shows up to 8 pictures per call, with `image_offset` to page through a gallery. |
| `view_images` | The main picture of up to 12 items at once, for comparing references like a moodboard. Reports IDs that are missing or have no picture. |
| `list_collections`, `list_tags` | Names and item counts. |

Pictures are every image in a gallery, a link's cover, page preview, and screenshots, a video's poster frame, and a PDF's first page. The browser decodes each one and re-encodes it as WebP: up to 1,568 px on the long side for `get_item` and 1,092 px for `view_images`, and smaller again if it would exceed about 600 KB. Originals never leave the library. The MCP server returns each picture as image content with a caption naming its item, so the model sees it the way it sees a pasted screenshot. Answers larger than one relay frame travel as ordered chunks of 512 KiB and are reassembled by `@keepall/mcp`.

Write tools, built:

| Tool | Behavior |
| --- | --- |
| `move_to_collection` | Puts items into a collection by name, creating it if needed. "Unsorted" takes them out. |
| `tag_items` | Adds and removes tags by name, creating new ones. Names ignore case. |
| `add_note` | Adds text below an item's note (a note's text, an image's caption), or replaces it. |
| `rename_collection` | Renames a collection unless the new name is taken. |
| `save_link`, `save_note` | Save new items with an optional note, collection, and tags. A link that's already saved gets organized instead of duplicated. |
| `move_to_trash` | Moves items to Trash. Nothing is ever deleted permanently, and Trash is never emptied. |
| `check_changes` | The agent's access level, what waits for review, what the user applied or declined, and recent change IDs. |
| `undo_change` | Reverses one of the agent's own changes. |

Still planned: `export_context_pack`, which would return a collection, tag, or search in the existing context pack format (`src/domain/context-pack.ts`).

### Access, review, and undo

The user picks an access level when pairing and can change it in **Settings → Agents**:

- **Read only.** Every write tool returns an error that says how to allow changes. Pairings made before writes existed are read only.
- **Suggest changes**, the default. Every write joins that agent's one open proposal, so twenty small tool calls become one review at `/review`.
- **Make changes.** A call that touches 10 items or fewer applies at once. Larger calls still wait for review.

Reviewing follows Unsorted review and uses the library's own parts:

- **The review page, `/review`.** The agent's link and Settings → Agents both lead here. Changes are grouped by what they do, however many tool calls suggested them, and each item appears as a library card: the same shell, squircle media, and corner selection control. The control includes or leaves the item out of **Apply all**, and each group has **Include all** or **Leave out all**. Notes show your existing text next to the added text. Trash and replaced notes show in the danger color. A sticky bar shows how many changes are included.
- **Review one at a time, in place.** Clicking a card, pressing Space on a focused card, or choosing **Review one at a time** opens Unsorted review's dialog right on the review page, starting at that item:
  - **The item, large,** with a card listing what the agent suggested and why.
  - **The same Collection and Tags cards** as Unsorted review, pre-filled with the suggestion and editable.
  - **Note and Trash suggestions,** each in its own card with **Leave out** or **Keep item**.
  - **The same footer:** Back, Next (leaves the item as it is), **Apply changes**, and **Undo**.
  - **At the end,** **Apply the rest as suggested** or **Decline the rest**.
  
  Each item you apply is its own change with a before-copy.
- **From the library.** While suggestions wait, the library also offers **Review Claude Code's changes** where **Review Unsorted** sits, and it opens the same dialog over the library. `/?agent-review=1` opens it directly.

Settings → Agents summarizes waiting proposals with **Review changes**. Agents can pass an optional `reason` with each write, which appears beside the change.

Suggestions remember a fingerprint of what they saw: each target item's collection, tags, note text and Trash state. Your later edits to those fields skip the suggestion with a reason. Background updates, such as a fetched link preview, don't.

Every applied change is stored in a journal with a before-copy of every row it touches, written in the same IndexedDB transaction as the change itself, so no change can land without its copy. When a backup folder is connected, applying a reviewed proposal also writes a full folder backup first. If that backup fails, the change still applies, and the result says the folder backup failed.

Undo restores only the fields agents can change: collection, tags, note text, and Trash state. It leaves anything the user edited since and lists it. Unrelated later updates, like a fetched link preview, survive. Items the agent created go to Trash. Collections and tags the agent created are removed only when nothing uses them.

Proposals record each target item's version when suggested. If the user edits an item before applying, that part is skipped and the reason is shown. Agents send a fresh request ID with every call, and the library remembers them, so a call re-sent after a reconnect never applies twice.

### Designed for simple agents

- **Forgiving input.** Write tools accept one ID or a list, tags as a list or a comma-separated string, and names regardless of case.
- **A next step in every result.** Each write result ends with `what_to_do_next`, a plain instruction. For example: "Tell the user exactly this: I've suggested 7 changes to your Keepall library. Review them here: <link>. After they say they've reviewed them, call check_changes."
- **Errors say how to fix the call.** For example, "No collection is named X. Use list_collections to see the names."
- **A CLI for agents without MCP.** `keepall-mcp tools` lists the same tools, and `keepall-mcp call <tool> '<json>'` runs one.
- **An eval.** `scripts/agent-eval.mjs` seeds a messy library (design and cooking links, notes, two images, two junk entries), pairs it, gives an agent one vague request ("tidy up my library…"), applies what it suggested, and scores the result. On November 21, 2026, Claude Haiku passed all 7 checks through the CLI in 7 tool calls and 37 seconds. It grouped design and cooking separately, tagged both images, summarized both notes, and trashed only the junk. It also handed the user the review link from `what_to_do_next`. Running the eval with `--agent claude` drives Claude Code over MCP, but that needs a signed-in `claude` CLI.

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

## Spike results

Built on `spike/agent-relay`. Everything runs locally: the relay under `wrangler dev`, the app under `next dev`, and the unpacked extension.

| Piece | Where |
| --- | --- |
| Shared protocol: pairing link, X25519 + HKDF pair key, per-connection AES-GCM sessions, library endpoint | `src/domain/agent-protocol.ts` |
| Read tools and picture resizing | `src/domain/agent-tools.ts`, `src/persistence/agent-tools.ts`, `src/persistence/agent-images.ts`, `packages/mcp/src/tools.ts` |
| Pairings, stored only on this device and never in backups | `src/persistence/agent-pairings.ts` (database version 13) |
| Library host, elected through a Web Lock, in the hidden bridge or an open tab | `src/app/extension-bridge/agent-host.ts`, `src/app/agent-host-runner.tsx` |
| Approval page | `src/app/connect/` |
| Relay Worker and Durable Object | `packages/relay/` |
| Stdio MCP server and `pair`, `unpair`, `search` commands | `packages/mcp/` |
| Extension: start the bridge on Chrome startup and after pairing | `extension/worker.js`, `extension/offscreen.js`, `externally_connectable` in the manifest |

Tests: protocol and tool unit tests in Vitest, five relay tests against `wrangler dev`, two MCP tests that drive the stdio server through a real relay, and `e2e/agent-access.spec.ts`, which pairs through `/connect` in Chromium with the extension loaded, closes the tab, and gets search results from the extension's hidden bridge.

What the spike showed:

- **Push may not be needed while Chrome runs.** The extension's offscreen document already outlives its background worker, so the bridge inside it can hold the relay connection with no pings and no push. The idle connection sends nothing, so the Durable Object hibernates. Still unverified: whether that connection survives hours idle, sleep and resume, and network changes, and whether Cloudflare closes long-idle hibernated sockets. Measure this with a deployed relay before building push.
- **The agent has to speak first.** The relay only routes library frames to an agent connection it has seen, so the agent announces itself when the library appears, during pairing and after.
- **WebCrypto X25519 works** in Node 24 and in the Chromium build Playwright ships. The minimum Chrome version for X25519 is still unchecked against the extension's `minimum_chrome_version` of 116.
- **No new extension permissions.** The change adds `externally_connectable`, `runtime.onStartup`, and `runtime.onMessageExternal`. Confirm in the Chrome Web Store dashboard that it doesn't trigger a warning.
- **The pairing link reaches browser history.** The page drops the fragment from the address bar after reading it, but the history entry is already written and may sync. The secret only matters until pairing completes. A short code shown by both the agent and the page would close that window.
- **The extension isn't always there.** In the first hands-on test, pairing worked but the extension in Chrome wasn't loading the bridge, so searches never reached the library. Two changes came out of it. First, an open Keepall tab now answers agents too: the bridge and every tab ask for the same Web Lock, so one context per browser profile holds the relay connections, and the next one takes over when it closes. Second, `/connect` says when Keepall Capture didn't respond, and the agent's errors name the missing piece (relay, no connected browser, handshake, or slow answer) and the library address to check.
- **Parallel calls before pairing now share one link**, and a retry on a connection that already knows the library is gone fails in about 3 seconds instead of waiting out the 30-second timeout.
- **Retried requests could run twice.** When the library reconnects mid-request, the agent re-sends under the new session. Write tools now carry request IDs the library remembers, so a re-sent write applies once.

Not done in the spike: deploying the relay (needs a Cloudflare login), measuring real usage, publishing `@keepall/mcp` (it imports `src/domain` directly, so publishing needs a bundling step, and running from source prints a Node module-type warning), checking Codex and OpenCode, revoking pairings in Settings, and push.

### Try it locally

```bash
pnpm --filter @keepall/relay dev
```

```bash
pnpm dev
```

Load `extension/` unpacked and set its library address to `http://localhost:3000`. Then add the server to Claude Code:

```bash
claude mcp add keepall -- node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON /absolute/path/to/keepall/packages/mcp/src/cli.ts
```

Ask Claude Code to search Keepall. The first call returns a pairing link. Open it in the same Chrome profile, choose what it can do, then **Connect**, and ask again.

## Slices after the spike

1. Read tools: `search_items`, `get_item`, `list_collections`, `list_tags`, `export_context_pack`. Pairing, revocation, and the paired agents list in Settings.
2. Writes with provenance: `save_link`, `save_note`, `trash_item`, items from agents marked in Unsorted, optional approval in the browser.
3. `organize` with proposals, using the existing organization preview.
4. Sealed write queue for offline writes.
5. Help page, extension store listing, and privacy page updates describing exactly what the relay can and can't see.
