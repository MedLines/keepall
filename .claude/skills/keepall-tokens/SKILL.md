---
name: keepall-tokens
description: Token lookup for Keepall UI. Use before writing a className that sets a colour, radius, type size, aspect ratio or shadow.
---

# Keepall tokens

`src/app/styles/tokens.css` is the only source of colour, radius, aspect and shadow utilities: Tailwind's own palette and `--aspect-*` scale are reset, so a class not backed by a token there does not exist. A guessed class is a miss even when lint lets it through.

## Steps

1. Name the role first (surface, text, edge, radius, type size, ratio), then take the class from the lookup below. Done when every styling class in your diff maps to a row here or to a token you read in `tokens.css`.
2. Role not listed: search `tokens.css` for the role word. Still nothing: use the nearest role, mark it _invented_ in your report, and propose a named token. Arbitrary values (`rounded-[…]`, `text-[…]`) are blocked by lint.

## Lookup

| Need | Class |
|---|---|
| Page background | `bg-bg-canvas` (sidebar: `bg-bg-shell`) |
| Panel, popover, settings section | `bg-bg-surface` |
| Card | `bg-bg-card` |
| Control or field surface | `bg-bg-control` |
| Nested tile, placeholder, hover | `bg-bg-raised`, `hover:bg-bg-raised` |
| Selected / active | `bg-bg-selected` / `bg-bg-active` |
| Body text / quiet text (hints, meta, "muted") | `text-text-primary` / `text-text-secondary` |
| Card meta line | `text-text-card-meta` |
| Default 1px edge | `border-border-control` |
| Destructive / warning | `text-text-danger` `bg-bg-danger` / `text-text-warning` `bg-bg-warning` |
| Control radius 10/12/13/14/24px | `rounded-control-xs` … `rounded-control-xl` |
| Field / panel / library panel radius | `rounded-input` (16) / `rounded-panel` (20) / `rounded-library-panel` (32) |
| Card radius | `rounded-card`; card media inherits the card's clip and sets no radius of its own |
| Type 10/11/12/13/14/15/16/20/22/28px | `text-2xs` `text-meta` `text-xs` `text-compact` `text-sm` `text-md` `text-base` `text-xl` `text-heading` `text-display` |
| Weight | `font-medium` for labels and row titles, `font-semibold` for headings |
| Media without a known ratio | `aspect-16/10` (fractions work; `aspect-video` does not exist) |
| Spacing | Tailwind's 4px scale (`gap-3`, `p-5`) |
| Text button side padding | `button-px-*` (default 4), never `px-*`; the icon side gets ¾ automatically |
