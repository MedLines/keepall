<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Keepall

Local-first personal library. Phase 1 is a complete local product; later phases are optional.

## Commands

- `pnpm dev` — development server
- `pnpm lint` — lint
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm test` — Vitest
- `pnpm test:e2e` — production build, then Playwright
- `pnpm build` — production build

## Boundaries

- Use pnpm, not npm or yarn.
- Never commit `.learning/` or `.cursor/plans/`.
- Do not add PWA, sync, tags, or collections unless the active slice authorizes them.
- `src/domain` is pure types and rules. `src/persistence` talks to Dexie. UI must not import `dexie`. Domain must not import React or Dexie.
- Open IndexedDB only in the browser after mount or in event handlers — never at module top level and never during Server Component render.
