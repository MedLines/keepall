# Library cards and media controls

Use `ItemTypeIcon` for item identity and `ItemTypeBadge` for grid previews. Put the badge at the bottom-end of the preview: bottom-right in English, matching the image-count badge. Use one glyph; do not repeat PDF, TXT, MD, or another type as adjacent text. A gallery count is the exception: show its number beside the images glyph. Keep selection and action buttons at the top of the card.

PDF and TXT use the installed file icons, with their extensions drawn into the glyph. MD uses the same folded file outline with MD lettering. Use the shared semantic type colors: PDF red, TXT blue, MD purple, notes amber, images green, links cyan, and videos pink. Use the same type glyph and color in list thumbnails and quick-preview headers. Action icons stay neutral or use their existing status colors.

Badges use 16px glyphs in a 32px-high surface. `library-card-media-chrome` supplies the same translucent surface, 12px radius, and squircle corner shape to badges and card controls. Avoid a maximum radius on these small icon surfaces so they retain flat sides, including in browsers without corner-shape support. The surface is dark in dark mode and light in light mode. Icons use the brighter `item-*-on-media` colors in dark mode and darker semantic type colors in light mode. Bottom and end insets share the corner-control inset minus the 8px media border: currently 14px inside the preview, matching the top controls' distance from the visible preview edge. Their accessible labels identify the type and gallery count; color is an additional cue.

Concentric radius math applies to the card and its full preview: 64px = 56px + 8px. Floating icon controls keep their own shared radius token rather than treating the 32px controls as scaled copies of the entire card. Collection and tag pills retain their approved maximum-radius control shape.

PDF grid covers show the first page as an image. CSS uses its intrinsic proportions with `width: 100%` and `height: auto`, including landscape and square pages. Do not give loaded PDF covers a fixed page ratio or calculate their displayed height in JavaScript. Thumbnail rendering stays lazy, bounded, and disposable.

Use `MediaViewerToolbar` for image quick previews and PDF viewers. Keep view choices on the left, navigation in the middle, and zoom on the right. At narrow widths, navigation moves to its own row. Scroll is always the last choice: Fit | Scroll, Pages | Scroll, or Slides | Scroll.

## Card content

Grid cards share the `--card-*` tokens in `globals.css`. Keep the 64px outer curve, 8px card inset, and 56px inner curve. Bare image cards keep the full 8px bottom inset; cards with footer content use 2px outer bottom padding in addition to the footer's own padding. Footers use 16px horizontal padding, 10px above their title, 12px below their content, and 6px between rows. Titles are 16px medium with a 22px line height. Truncate to one line; link cards without an OG asset may show two lines. Website descriptions are 12px secondary text, one line with an OG asset or two without one. Source hosts and file metadata are 11px muted text with a 16px line height.

Use `CardSource` for external source hosts on links and images, including images with captions. It always includes the external-arrow glyph. A local filename has no external arrow. PDFs retain their original filename when it differs from their title beyond the extension.

Use `CardNote` for personal notes and image captions: a Note glyph for plain text or an MD glyph for Markdown, followed by one truncated 13px line in the primary text color. The visible row is 24px high with an expanded hit area and an 8px gap after the source. Only show it when there is content. It opens the Keepall item; link titles and source hosts open the website. Keep details and editing actions in the item page, preview, and action menu.

Collections and tags use separate `library-card-metadata-pill` buttons with the same raised surface, maximum radius with squircle-style ends, 32px height, 8px horizontal padding, and 6px icon gap. Use `rounded-full` with the shared `superellipse(1.5)` control corner shape. The collection stays left and tags right. Each has its own interaction.

Place the collection and tag pill edges 16px from the outer card, 6px outward from the corner controls. Pills retain 8px horizontal padding and both icons lead their labels. The folder glyph starts at the footer's 24px content inset, aligned with the source and note icon slots above it. Source favicons remain 11px, centered in a 16px slot. Source and note rows have no extra horizontal offset. Corner controls retain their 32px visible surfaces and 44px click targets, with centers 38px from the edges. Type badges and the action glyph share the right column; gallery counts precede the glyph.

## Reading previews

Notes, MD, and TXT share `LibraryReadingCard`. Place the title and file metadata or edit date below the reading inset. Use the reading surface so the inset is dark in dark mode and light in light mode. Short excerpts shrink to their content with a 96px minimum inset; long excerpts cap at 216px. Reserve the bottom space for the type badge. Excerpts use 13px text, 14px semibold Markdown headings, and a bottom fade over the final 48px. Cards have no nested text scrollbar or content-height measurement in JavaScript.

Markdown frontmatter is quiet, bounded plain metadata in the preview. The original document stays intact. Preview links, images, HTML, and inputs cannot become active content. Search highlighting still applies to body and metadata. TXT identifies imported `.txt` files; plain written notes use Note and Markdown notes use MD.

## Popup motion and text fields

Use `uiMotion` for interaction timing and its derived CSS variables for CSS transitions. Menus use the fast tier, drawers the moderate tier, and dialogs the slow tier; dismissals use the paired, quicker exit. Popup transforms follow the resolved side after collision handling. Keep the existing cover morph and icon-swap timings separate.

The root `MotionProvider` respects the system's reduced-motion setting. CSS popups keep their opacity fade but drop scaling and sliding; drawers appear in place. Standalone motion components must also guard their exit transforms.

Top-bar selects use `MenuHoverList` for one moving highlight that follows Base UI's existing pointer and keyboard target. Measure layout offsets only when that target or the list changes, batch measurements into one animation frame, and animate only the highlight's transform. Keep the existing row fill until a usable measurement exists.

Searchable collection and tag menus use natural content height with a viewport cap; scroll only when their results exceed it. Small text inputs, textareas, and native selects use 16px text on touch devices while retaining desktop sizing.

## Scrolling panels

Use the registry `ScrollArea` for capture and organizer drawer bodies, organization browsing, and shared dialog content. Constrain the outer box, put `scroll-fade` on `viewportClassName`, and put padding on its content. Keep headers and action footers outside the scrolling box. Compose the installed component without editing it.

Desktop thumbs widen from 4px to 6px on hover inside a 10px track. The overlay tint follows Keepall's `data-theme`, and touch uses native overflow. Scroll areas do not reserve a scrollbar gutter; fades stay on the viewport so the track remains usable. The registry component's forwarded ref targets its outer box. Use `ScrollPanel` when a virtualizer, reading-position handler, or image viewer needs a real viewport ref or viewport attributes. Keep `data-document-scroll` on that viewport so PDF page jumps and sticky controls use the correct scroller. `ScrollTextarea` composes the same track around a native textarea viewport, preserving labels, selection, caret scrolling, and keyboard shortcuts.


About and Help retain window scrolling for scroll-driven scenes, sticky navigation, and article anchors. Their native window scrollbar uses the same overlay tint ramp; its dark color follows the public page rather than the library's theme preference. Help guide contents use the shared vertical track on desktop and horizontal track on narrow screens. Decorative screenshots and demo crops remain non-scrolling.

Desktop sidebar rows use 36px height and 12px section spacing; mobile keeps its larger targets. The resize hairline is hidden at rest and stops short of rounded corners, fading at both ends. Click or Enter toggles the existing icon rail. Drag width follows the pointer without a spring; collapse previews use moderate motion and normal toggles use slow motion. Reduced motion applies widths immediately. Freeze only the library viewport during resizing and motion, leaving the top toolbar responsive. Escape and pointer cancellation restore the previous width without saving a drag preview.
