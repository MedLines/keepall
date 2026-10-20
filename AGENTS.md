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

## Architecture Decisions (CRITICAL)

- **Primary action color**: In the dark theme, `.ui-primary` is white (`--color-action-primary` = `--white`) with dark text and a soft-grey hover (`--color-action-primary-hover` = `--neutral-150`) plus a small shadow lift. NEVER use a mid-grey (`--neutral-400`) for primary actions — it reads as disabled.
- **Transient confirmations**: Trash undo and similar transient notices live in the library top bar's action slot (`LibraryTopBar` `notice` prop), never inline above the cards. NEVER render an undo or status banner inside the library scroll content (it shifts layout). Footer confirmations take over the action area — never append text beside the action buttons (it pushes them sideways). Undo withdraws after 6s, pauses on hover, focus, busy, or a hidden tab, and stays until dismissed after a failed undo. (ref: 2026-10-20-keepall-top-bar-undo-notice)
