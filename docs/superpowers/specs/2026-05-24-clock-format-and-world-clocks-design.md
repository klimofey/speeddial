# Clock format + World clocks — design

**Date:** 2026-05-24
**Status:** approved
**Builds on:** the existing SpeedDial MV3 extension (feat/speeddial-mvp).

## Goal

1. A **12h / 24h** clock-format setting, applied to the main clock and to widgets.
2. A **world-clocks widget** — a compact row of clocks for user-chosen IANA time
   zones, shown near the top, managed in Settings.

Authentication/integration widgets (Home Assistant, Proxmox, servarr, Pi-hole,
…) are explicitly **out of scope** here — a separate future subsystem.

## 1. Time formatting — `src/lib/time.ts`

- `formatTime(date: Date, opts: { timeZone?: string; hour12: boolean }): string`
  → `date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: opts.hour12, timeZone: opts.timeZone })`.
  Fixed `'en-US'` locale → deterministic ("20:00" for 24h, "08:00 PM" for 12h),
  so tests are stable and the main + world clocks render consistently.
- `listTimeZones(): string[]` → `Intl.supportedValuesOf('timeZone')` when
  available, else a small fallback array (`['UTC']`). Guarded for environments
  without `supportedValuesOf`.
- `labelForZone(tz: string): string` → last `/`-segment, underscores → spaces
  (e.g. `America/New_York` → `New York`); returns the input unchanged if no `/`.

## 2. Clock format

- `Settings` gains `clockFormat: '24h' | '12h'` (default `'24h'`).
- `Clock` takes a `format: '24h' | '12h'` prop and renders via
  `formatTime(now, { hour12: format === '12h' })`. Greeting logic unchanged.

## 3. World clocks

- `Settings` gains `worldClocks: WorldClock[]` (default `[]`), where
  `WorldClock = { id: string; timeZone: string; label: string }`.
- `src/components/WorldClocks.tsx` — props `{ clocks: WorldClock[]; format: '24h' | '12h' }`.
  Renders nothing when `clocks` is empty. Otherwise a compact horizontal row;
  each item shows `formatTime(now, { timeZone, hour12 })` and the `label`. A
  single shared 1-second interval drives re-render.
- Placement: in `<NewTab>`'s header, directly under `<Clock>` (above the search bar).

## 4. Settings panel additions

- A "Clock format" select (24-hour / 12-hour) bound to `clockFormat`.
- A "World clocks" section:
  - Lists each configured clock: an editable label input + the zone + a remove
    button (by `id`).
  - An "Add" control: a `<select>` populated from `listTimeZones()` plus an Add
    button. Adding pushes `{ id, timeZone, label: labelForZone(timeZone) }`.
  - Editing a label updates that clock's `label`; remove drops it by `id`.

## 5. NewTab wiring

- `<Clock>` receives `format={settings.clockFormat}`.
- `<WorldClocks clocks={settings.worldClocks} format={settings.clockFormat} />`
  rendered under the clock, gated by `settings.showClock` (same toggle as the
  main clock — world clocks are part of the clock widget area).

## 6. Data / schema

- `SCHEMA_VERSION` stays `1`; `clockFormat` and `worldClocks` are additive and
  covered by the existing `{ ...DEFAULT_SETTINGS, ...stored }` merge, so older
  backups load (missing fields fall back to defaults). Backups already round-trip
  arbitrary settings, so no backup changes are needed.

## 7. Error handling

| Situation | Behavior |
|---|---|
| `Intl.supportedValuesOf` unavailable | `listTimeZones` returns `['UTC']`; add still works |
| Invalid `timeZone` in a stored clock | `formatTime` would throw → `WorldClocks` renders that item's time as `'--:--'` (per-item try/catch) |
| `worldClocks` empty | Widget hidden |

## 8. Testing

- `time.ts`: `formatTime` for 12h vs 24h at a fixed UTC instant and a specific
  zone (e.g. `America/New_York`); `labelForZone` underscore/segment handling;
  `listTimeZones` returns a non-empty array including a known zone.
- `Clock`: renders 24h vs 12h (mock system time; assert presence of `PM` only in 12h).
- `WorldClocks`: one item per clock with its label; empty → renders nothing;
  invalid zone → `'--:--'` fallback.
- `Settings`: changing the format select emits `clockFormat`; adding a zone emits
  a `worldClocks` array with the new entry; removing emits the shortened array.

## 9. Out of scope (YAGNI)

- A general widget framework / drag-reorder of widgets (just the world-clock row now).
- Analog clock faces, seconds display, date-in-zone.
- Any auth/integration widgets (separate future spec).
