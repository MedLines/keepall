# About page design direction

Keepall is a personal library for people saving links, notes, images, and videos.
The public page should feel considered and welcoming, with enough product detail
to explain the extension and installation without assuming technical knowledge.

## Reference study, 27 September 2026

These are visual observations from the supplied sites, not assets or layouts to copy.

| Reference | Useful cue | Keepall application |
| --- | --- | --- |
| [Fora](https://fora.so/) | Atmosphere connects the headline to a large product view. | A warm graphite opening and a framed library preview form one composition. |
| [Umbrel](https://umbrel.com/) | Warm photography makes a technical product feel personal. | Existing architectural and interior images, paper notes, and plain explanations of local storage. |
| [DialKit](https://www.dialkit.dev/) | Physical depth and oversized type give interface objects presence. | Saved objects flank the desktop headline; the capture control has an inset track and a raised selected state. |
| [AuthKit](https://www.authkit.com/) | Fine borders, aligned guides, and concentrated lighting organize a dark page. | A restrained page frame, subtle surface edges, and clear section alignment. |
| [Satellitor](https://satellitor.com/) | Bright, dimensional actions and a large framed preview establish priority. | Porcelain-colored primary buttons and a single prominent product frame. |

## Rules for the page

- Keep graphite, warm white, and muted rose as the base palette. Warm light belongs
  around product examples, with readable body text on stable backgrounds.
- Let saved content carry the visual identity. Use Keepall's own images and logo.
- Give controls clear borders, focus states, and short press feedback. Reserve
  depth for things that can be used or kept, rather than decorating every section.
- Alternate large scenes with open text. Organization examples have separate
  captions instead of enclosing every explanation in a card.
- Keep installation concrete: Desktop, Android, and iPhone each link to their
  existing guide. Explain that an app opens the library and an extension saves to it.
- At phone widths, remove peripheral decorative objects and frame two larger
  preview columns. All real actions and instructions remain available.
- Keep motion brief and honor reduced motion. Avoid autoplay loops, scroll
  interception, and new animation dependencies.

The page uses existing assets and CSS. The capture demo remains an explicitly
labeled preview; the page does not write to the visitor's library.
