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

- `Type badge` → `Type`, from the item's type.
- `Metadata pill` → `Kind`: a collection pill versus a tag-count pill inside `LibraryCardMetadata`.
- `Segmented switch` → `Selected`: which of the two choices is the current `value`.
- `Selection control` → `State`: the `selected` boolean.
- `Radio card` → `State`: the input's `checked` state.

## Content slots

Figma `TEXT`, `INSTANCE_SWAP` and `BOOLEAN` ("Show …") properties stand for children, icon props and conditional content in code. Their names describe sample content, so they are not compared with code props.

## Props with no design value

Callbacks (`on*`), refs, `className`-style props, portal containers, `id`, `children` and other React-only props have no Figma counterpart.

## Shadows

Figma colour variables hold only a shadow's colour. Offsets, blur and spread live in effect styles on the nodes. `--shadow-image` has three layers, so Figma splits its colours into `shadow/image-1`, `-2` and `-3`, all pointing at `var(--shadow-image)`. The parity check compares each colour with the matching layer, in order.

## Units

Figma stores numbers. Code uses `rem`, `px`, `ms`, unitless opacity and `calc(var(--spacing) * n)`. The parity check converts code values to Figma's numbers before comparing them: 16px per rem, 4px per spacing step, milliseconds as written, and opacity as a percentage (`0.6` → `60`).

## Computed and fluid values

`calc()`, `min()`, `max()`, viewport units and `var()` fallbacks (such as `--viewer-control-size`) resolve at runtime. Figma uses one representative number for each.

## Colour-scheme scopes

Each colour role resolves through `light-dark()` in its own `color-scheme` scope. The public pages are always dark, and PDF text layers are always light. Figma has one Light and one Dark mode per collection, so frames that stand for those scopes must set the mode explicitly.

## Tokens outside tokens.css

Tailwind's default theme supplies `--text-*`, `--spacing` and a few radius values. `motion-tokens.ts` derives the `--motion-*-enter` and `--motion-*-exit` durations from its spring tiers. Some card geometry lives in `library-content.css`. `manifest.code.json` lists these under `tokens.otherSources`, so Figma variables that point at them count as matched.

## Spring motion

The `uiMotion` tiers are springs (duration plus bounce). Figma keeps only their durations.

## Non-visual components

`MotionProvider` and `Toaster` render no design surface of their own. `Toaster`'s toasts are drawn in Figma as `Toast`.
