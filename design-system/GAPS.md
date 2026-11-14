# Known gaps between code and Figma

Code is the source of truth and the Figma library mirrors it. Some things the code does cannot be expressed in Figma. `pnpm ds:parity` reports these as **gaps**, not drift. `parity.config.json` points each gap at the section below that explains it.

## Superellipse corners

CSS `corner-shape: superellipse(1.5)` with `border-radius: 999px` gives Keepall's pills and squircles. Figma has no corner shape, so those surfaces use a fixed radius tuned to look close at each size. The `render/*` radius variables hold those tuned values. They share a code syntax with the real token or `999px`, but their numbers are not meant to match it. `--corner-shape-panel` and `--corner-shape-control` have no Figma variable for the same reason.

## Card radius fallback

`--radius-card` is `1.5rem` in `tokens.css`. The components layer raises it to `4rem` where `corner-shape` is supported, so cards use 64px with the squircle and 24px without it. Figma keeps both as `radius/card` (64) and `radius/card-fallback` (24), and both point at `var(--radius-card)`.

## Interaction states

Hover, focus, active, pressed, highlighted and disabled are CSS states in code: pseudo-classes, `data-*` attributes from Base UI, and the native `disabled` attribute. Figma draws each one as a value of a `State` variant property. That property is not a code prop, so the parity check skips it.

## Data-driven variants

Some Figma variants show what a component renders for different data, not a prop:

- `ItemTypeBadge` → `Type`, from the item's type.
- `ItemTypeIcon` → `Type`, from the item's type.
- `LibraryCardMetadata` → `Kind`: a collection pill versus a tag-count pill inside `LibraryCardMetadata`.
- `SegmentedControl` → `Selected`: which of the two choices is the current `value`.
- `LibrarySelectionControl` → `State`: the `selected` boolean.
- `RadioCard` → `State`: the input's `checked` state.

## Content slots

Figma `TEXT`, `INSTANCE_SWAP` and `BOOLEAN` ("Show …") properties stand for children, icon props and conditional content in code. Their names describe sample content, so they are not compared with code props.

## Props with no design value

Callbacks (`on*`), refs, `className`-style props, portal containers, `id`, `children` and other React-only props have no Figma counterpart.

## Shadows

Figma colour variables hold only a shadow's colour. Offsets, blur and spread live in effect styles on the nodes. `--shadow-image` has three layers, so Figma splits its colours into `shadow/image-1`, `-2` and `-3`, all pointing at `var(--shadow-image)`. The parity check compares each colour with the matching layer, in order.

## Units

Figma stores numbers. Code uses `rem`, `px`, `ms`, `em`, unitless opacity and `calc(var(--spacing) * n)`. The parity check converts code values to Figma's numbers before comparing them: 16px per rem, 4px per spacing step, milliseconds as written, opacity as a percentage (`0.6` → `60`), and letter spacing as a percentage of the font size (`-0.03em` → `-3`), the unit Figma's letter-spacing field uses.

## Computed and fluid values

`calc()`, `min()`, `max()`, viewport units and `var()` fallbacks (such as `--viewer-control-size`) resolve at runtime. Figma uses one representative number for each.

## Colour-scheme scopes

Each colour role resolves through `light-dark()` in its own `color-scheme` scope. The public pages are always dark, and PDF text layers are always light. Figma has one Light and one Dark mode per collection, so frames that stand for those scopes must set the mode explicitly.

## Tokens outside tokens.css

Tailwind's default theme supplies `--text-*`, `--spacing` and a few radius values. `motion-tokens.ts` derives the `--motion-*-enter` and `--motion-*-exit` durations from its spring tiers. Some card geometry lives in `library-content.css`. `manifest.code.json` lists these under `tokens.otherSources`, so Figma variables that point at them count as matched.

## Spring motion

The `uiMotion` tiers are springs (duration plus bounce). Figma keeps only their durations.

## Non-visual components

`MotionProvider` renders no design surface of its own; it only makes Motion animations follow the reduced-motion setting.

## Caller-sized variants

`Button size="none"` adds no size classes; the caller sets height, padding and type. It has no fixed look, so Figma does not draw it.

## Media chrome surface

`.library-card-media-chrome` is the translucent surface that card corner controls and type badges sit on. Figma draws it as `IconButton` `Style=Media chrome`. In code it is a class, not an `IconButton` prop, so the `Style` property is not compared.

## Behaviour and containers

`MenuHoverList` (the gliding highlight), `ScrollArea` and `ScrollPanel` (scroll containers), `SearchHighlight` (text marking), `TooltipContent` (the same surface as `Tooltip`, without its root) and `ThemeControl` (a `Button` that toggles the theme) add behaviour or wrap other parts. Figma shows them through the parts they use.

## Utility aliases

`--color-white` and `--color-black` exist so Tailwind generates `bg-white` and `text-black`. Figma's `white` and `black` primitives stand for them.

## Fixed colours

Two kinds of Figma layers keep literal colours on purpose, so they look the same in every theme. The Keepall logo on the Cover (`#ff4a6b` and its tints, gradients and glow) is the brand mark, matching code's one brand-colour exception. The `Media` and `Thumbnail` gradients in `Library card` and `List row` stand in for photos, and photos don't change with the theme.

