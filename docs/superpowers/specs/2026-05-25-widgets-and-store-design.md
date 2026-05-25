# Widget system + Store (Part 2) — design

**Date:** 2026-05-25
**Status:** approved
**Builds on:** the dashboard grid + edit mode (Part 1) of the SpeedDial MV3 extension.
**Migration:** none — solo user, free to break and rebuild old data.

## Goal

Turn grid tiles into a pluggable widget system: each tile is either a link card (as
today) or a **widget** chosen from a **Store**. Ship a widget **registry**, a
`WidgetHost`, two widgets (**Note**, **Clock**), and move the main clock/world-clocks
out of the header into the grid as clock widgets. Adding a new widget type later =
one registry entry + one component.

## 1. Item model — `src/lib/types.ts`

- `WidgetType = 'note' | 'clock'` (extensible).
- Typed configs and a discriminated instance:
  ```ts
  export interface NoteConfig { text: string; }
  export interface ClockConfig { timeZone: string; label: string; showGreeting: boolean; }
  export type WidgetInstance =
    | { type: 'note'; config: NoteConfig }
    | { type: 'clock'; config: ClockConfig };
  ```
- `Dial` gains `widget?: WidgetInstance`. No `widget` → link card (existing). Storage
  shape, backup, `size`/`order`/resize/reorder are reused unchanged.
- `Settings` **drops** `showClock`, `greetingName`, `worldClocks`; **keeps**
  `clockFormat` (global, applies to all clock widgets). (No migration: dropped fields
  are simply gone; `WorldClock` type and `splitWorldClocks` are removed.)
- `DEFAULT_DIALS`: a fresh layout **seeds one local-clock widget** so the dashboard
  isn't clock-less. `storage.getDials` returns `DEFAULT_DIALS` when nothing is stored
  (instead of `[]`).

## 2. Registry + host — `src/components/widgets/`

- `registry.tsx`: `WidgetDef = { type, nameKey, icon, defaultSize: {w,h}, defaultConfig, Render, ConfigEditor }` and `WIDGETS: WidgetDef[]` (for the Store). `getWidget(type)` lookup.
- `WidgetHost.tsx`: `WidgetHost({ widget, settings })` → `getWidget(widget.type)?.Render({ config: widget.config, settings })`; unknown type → a small "?" placeholder tile.
- `NoteWidget.tsx`: `Render` shows the note text (empty → muted hint); `ConfigEditor` is a `<textarea>` editing `config.text`.
- `ClockWidget.tsx`: `Render` ticks each second, shows `formatTime(now, { timeZone: config.timeZone || undefined, hour12: settings.clockFormat === '12h' })`, the `label` (or the zone city), and the greeting when `showGreeting` (local only); `ConfigEditor` = timezone `<select>` (from `listTimeZones`), label input, greeting checkbox. (This replaces the old `ClockSettings`/`WorldClocks` components.)

## 3. Card rendering — `src/components/DialCard.tsx`

- If `dial.widget`: render a widget tile — `<div class="dial-card widget-card" style=span>` containing `<WidgetHost widget settings />` plus, in edit mode, a ⚙ config gear, ✕ remove, and the resize handle (no `<a>` link).
- Else: the existing link card (CardThumb + title + ✎/✕ + resize).
- New props: `onConfig?: (dial) => void` (gear → opens the widget's config). Links keep `onEdit` (✎ → CardEditor).

## 4. Store — add tiles in edit mode

- The bottom **"+ Add"** button (was "+ Add card") opens a **Store** modal listing:
  *Link card*, *Note*, *Clock* (each with icon + name; future ones greyed "coming soon").
- Choosing **Link card** → opens `CardEditor` for a new link (as today).
- Choosing a **widget** → `addWidget(type)` creates a `Dial` with the registry's
  `defaultConfig` + `defaultSize`, appended; then immediately opens that widget's
  `ConfigEditor`.

## 5. Config editing

- `AppState` gains `addWidget(type)` and reuses `updateDial` for config saves
  (`updateDial({ ...dial, widget: { type, config } })`).
- `NewTab` tracks `configuring: Dial | null`; renders the configured widget's
  `ConfigEditor` from the registry inside the existing modal shell. The ⚙ gear on a
  widget tile sets `configuring`.

## 6. Header rework

- Remove the clock/world-clocks block from the header; the header is just the
  `SearchBar`. The Recent row and grid follow as today. The edit toggle and ⚙
  settings gear stay. (The old in-header clock-config gear is gone — clocks are tiles
  now, configured via their own ⚙.)

## 7. Settings

- Remove the clock controls already moved out earlier? They were in `ClockSettings`
  (opened from the header clock gear). `ClockSettings` is deleted; clock config lives
  in the Clock widget's `ConfigEditor`. `Settings` keeps the global **Clock format**
  select (24h/12h) — move that one control into the Settings panel (it was in
  ClockSettings). Everything else in Settings stays.

## 8. Storage / backup

- Unchanged mechanism: `widget` lives inside each `Dial`; `getDials`/`setDials`,
  backup `buildSnapshot`/`restore`, and sync already serialize it. Only change:
  `getDials` returns `DEFAULT_DIALS` (the seeded clock) when nothing is stored.

## 9. i18n

- New keys: `widget_note`, `widget_clock`, `widget_link`, `store_title`, `add` (Store
  trigger), `note_placeholder`, `clock_zone`, `clock_label`, `clock_show_greeting`,
  `coming_soon`, plus reused `clock_format`/`fmt_24`/`fmt_12`, `save`, `close`,
  `delete`, `edit`. Added to all five dictionaries.

## 10. Testing

- `registry`: lookup by type, `WIDGETS` lists the shippable types, default sizes.
- `WidgetHost`: renders the right widget by type; unknown type → placeholder.
- `NoteWidget`: shows text; ConfigEditor edits `config.text`.
- `ClockWidget`: local + IANA zone render via `formatTime`; greeting shown only when
  `showGreeting`; ConfigEditor emits zone/label/greeting changes.
- `storage.getDials`: empty store → `DEFAULT_DIALS` (one clock widget); stored items
  preserved.
- `AppState`: `addWidget('note')` appends a Dial with the note default config/size;
  config save via `updateDial`.
- `DialCard`: widget dial renders `.widget-card` + gear (edit mode), no `<a>`; link
  dial unchanged.
- `NewTab`: header has no clock; "+ Add" opens the Store; choosing Note adds a tile;
  Settings shows the Clock-format select.
- Update/replace tests that referenced removed pieces (`WorldClocks`, `ClockSettings`,
  `splitWorldClocks`, `showClock`/`worldClocks` settings, header clock gear).

## 11. Out of scope (later)

- Translator widget (Part 3) — another registry entry.
- Weather / integration widgets.
- Per-breakpoint layouts.
- Drag widgets between a dedicated "top row" vs the grid — one unified grid for now.
