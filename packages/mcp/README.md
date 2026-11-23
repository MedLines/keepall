# @keepall/mcp

Connect Claude Code, Codex, OpenCode, Claude Desktop, or any MCP agent to your [Keepall](https://www.keepall.app) library.

Your library stays in your browser. The agent talks to it through Keepall's relay, encrypted end to end: the relay forwards ciphertext and can't read your library or send it commands.

## Set up

1. In Keepall, open **Settings → Agents → Connect an agent**.
2. Pick your agent and what it can do, then choose **Create setup**.
3. Paste what Keepall shows. For Claude Code that's:

   ```bash
   claude mcp add -s user keepall -- npx -y @keepall/mcp@1 --code keepall_…
   ```

4. Start a new session and ask the agent to search Keepall.

Keep Chrome open with Keepall Capture installed, or a Keepall tab open, so your library can answer.

The setup code works like an API key. Don't share it. **Disconnect** in Settings → Agents revokes it.

## What agents can do

- Search, read, and look at saved items, including images.
- With your permission: move items between collections, tag them, add notes, save links, Markdown notes, and files (images, videos, PDFs, `.md` and `.txt`, from a path or a URL), and move items to Trash.

By default, changes wait for your review in Keepall. Every applied change keeps a copy of what it touched, so it can be undone.

## Requirements

Node.js 22 or newer.

## Commands

```bash
npx -y @keepall/mcp@1 --code <code>           # run as an MCP server over stdio
npx -y @keepall/mcp@1 tools                   # list the tools
npx -y @keepall/mcp@1 call search_items '{"query":"typography"}' --code <code>
```

The code can also come from the `KEEPALL_CODE` environment variable.

## Source

[github.com/MedLines/keepall](https://github.com/MedLines/keepall), in `packages/mcp`. The relay is in `packages/relay`.
