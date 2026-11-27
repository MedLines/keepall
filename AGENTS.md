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

## Design system rules for agents

Storybook is the closed list of UI parts. Run `pnpm storybook`; the `keepall-storybook` MCP server in `.mcp.json` reads it.

- **Before writing UI**, call `docs-list` once, then `docs-show` only for the components you will use. Use only the props and values it documents.
- **Build from what exists**: components from the MCP list, colours from the semantic roles in `src/app/styles/tokens.css` (`bg-*`, `text-*`, `border-*`), sizes, spacing, radius and shadows from its tokens or Tailwind's scale. Style through `className`; an inline `style` carries only runtime values (measured geometry, motion values) behind an `eslint-disable` comment that says why.
- **When a part is missing**, compose it from existing parts, list it as _invented_ in your report, and ask before adding a component to `src/components/ui`.
- **Interface text** you write goes in `src/i18n/messages/en.ts` as whole ICU sentences, read through `useTranslations()`; dates and numbers take `useFormatLocale()`. Rules: "Interface text and languages" in `docs/interface-conventions.md`.
- **Icons** come from `@/app/shell-icons` (Hugeicons; see Storybook's Foundations/Icons) and `DocumentIcon` for file types.
- **Imports**:

  ```tsx
  import { Button, IconButton } from "@/components/ui/button";
  import { Tooltip } from "@/components/ui/tooltip";
  import { CloseIcon } from "@/app/shell-icons";
  ```

  Base UI parts that render their own element take `buttonClassName()`, `iconButtonClassName()` (both in `@/components/ui/button`) or `menuItemClassName()` (`@/components/ui/menu-item`) instead; the RowActionMenu and MenuHoverList stories show them in use.
- **Text button padding**: set a text button's side padding with `button-px-*` (default 4), never `px-*`; the side with an icon then gets three quarters of it. Text beside an icon must be an element (`Button` wraps bare strings itself). Lint enforces both.
- **Retired patterns**: a native `title` (use `Tooltip`), a hand-built `<button>` (use `Button` or `IconButton`), `ScrollArea` inside `role="menu"` (use a native `ui-scrollbar` scroller), Tailwind palette colours such as `bg-sky-50` (the palette is closed; use a role).
- **New UI ships with a story** beside it (`*.stories.tsx`, invented fixtures on `.example` domains).
- **Judgment calls** (spacing defaults, which of two similar components wins) follow `docs/interface-conventions.md`. When you settle a new one, add it there.
- **The gate**: a hook lints every file you edit, and `pnpm lint` must pass.
