# Dashboard grid + edit mode (Part 1) — design

**Date:** 2026-05-24
**Status:** approved
**Builds on:** the existing SpeedDial MV3 extension (feat/speeddial-mvp).

This is **Part 1 of 3** of the dashboard vision:
1. **(this spec)** Resizable, reorderable grid + edit mode — links only.
2. Generic item model + widget registry + Store + world-clocks-as-widget.
3. Translator widget (translation-engine decision lives there).

## Goal

Turn the flat dial grid into an auto-packing dashboard where each card has a
**size** (grid span), users **resize / reorder / remove / add** cards in an
**edit mode**, and the layout stays responsive. A 1×1 card looks exactly like the
current saved-link card. No widgets yet — that's Part 2.

## 1. Data model

- Extend `Dial` with `size: { w: number; h: number }` (grid-cell span).
- Migration: `getDials()` already returns stored dials; loading defaults a missing
  `size` to `{ w: 1, h: 1 }` (so existing dials and old backups render unchanged).
  This is done in `storage.getDials` (map each dial to `{ size: { w:1,h:1 }, ...d }`)
  so every consumer sees a populated `size`.
- `order` (existing) still drives auto-flow placement; no x/y coordinates are
  stored — dense packing derives positions from order + sizes.

## 2. Layout helper — `src/lib/layout.ts`

- `MAX_SPAN = 4` (max cells a card may span in either axis).
- `clampSpan(value: number, max = MAX_SPAN): number` → `Math.max(1, Math.min(Math.round(value), max))`.
- Pure and unit-tested; used by the resize interaction to bound `w`/`h`.

## 3. Grid rendering — `src/components/DialGrid.tsx`

- CSS Grid: `grid-template-columns: repeat(auto-fill, minmax(<cell>, 1fr))`,
  `grid-auto-rows: <cell>`, `grid-auto-flow: dense`, where `<cell>` matches the
  current card footprint (driven by `settings.cardSize`, as today).
- Each card sets `style="grid-column: span {w}; grid-row: span {h}"`.
- Responsiveness: column count follows container width (auto-fill). A card whose
  `w` exceeds the available columns is clamped by the browser to full width — so
  nothing overflows on narrow screens; no JS needed for render-time clamping.

## 4. Card content at sizes > 1×1 — `src/components/DialCard.tsx`

- The card already fills its cell (`.dial-thumb` is `aspect-ratio:1` today; for
  spanned cards the thumb fills the cell via `height:100%`). The preview
  (favicon/image/letter) scales to the cell; the title stays below. No per-card
  align/scale controls in Part 1 (deferred; the responsive grid already gives
  adaptive reflow).

## 5. Edit mode — `src/components/NewTab.tsx` (Board)

- `editMode: boolean` state. An **"Edit"** toggle button next to the ⚙ gear
  enters it; a **"Done"** button exits.
- **Normal mode:** clicking a card opens its URL (as today). Drag-and-drop and
  resize/remove handles are NOT active.
- **Edit mode:**
  - **Drag-and-drop reorder** via SortableJS, enabled only while editing (created
    on enter, destroyed on exit). `onEnd` reads the DOM order of `.dial-card`
    elements and calls `reorderDials(ids)` (existing). Card links are
    non-navigating while editing (the anchor's default click is prevented) so a
    click doesn't open the site mid-edit.
  - **Resize handle** (bottom-right corner of each card): dragging it changes the
    card's `w`/`h` in whole cells via `clampSpan`, persisted with `resizeDial`.
  - **Remove** (× corner) calls existing `removeDial`.
  - **"+ Add card"** stays (opens `CardEditor`).
- `DialGrid` gains an `editing: boolean` prop; `DialCard` gains `editing` plus an
  `onResize(id, size)` callback; SortableJS init is gated on `editing`.

## 6. AppState — `src/state/AppState.tsx`

- Add `resizeDial(id: string, size: { w: number; h: number })` → updates that
  dial's `size` and persists via the existing `persistDials`.
- `addDial` sets `size: { w: 1, h: 1 }` on new cards.

## 7. Error handling

| Situation | Behavior |
|---|---|
| Stored dial missing `size` (old data) | Defaulted to `{1,1}` in `getDials` |
| Resize beyond limits | `clampSpan` bounds to `[1, MAX_SPAN]` |
| `w` wider than current columns | Browser clamps span to full width (no overflow) |

## 8. Testing

- `layout.ts`: `clampSpan` — rounds, floors at 1, caps at MAX_SPAN, default max.
- `storage.getDials`: a stored dial without `size` comes back with `{ w:1, h:1 }`;
  an existing `size` is preserved.
- `AppState`: `resizeDial` updates a dial's size and persists.
- `DialGrid`: renders `grid-column/row: span` styles from each card's `size`;
  with `editing` true the SortableJS init runs and resize/remove affordances are
  present; with `editing` false they are not. (SortableJS mocked as today.)
- `DialCard`: in `editing` mode renders the resize handle and remove button and
  does not navigate on click; in normal mode renders the link normally.

## 9. Out of scope (Part 2/3)

- Widgets, widget registry, and the Store gallery.
- A generic `GridItem` (link | widget) model — Part 1 keeps the `Dial`-based model
  and adds `size`; Part 2 generalizes it.
- Per-card content align/scale controls.
- World clocks as a grid widget (currently stays in the header).
