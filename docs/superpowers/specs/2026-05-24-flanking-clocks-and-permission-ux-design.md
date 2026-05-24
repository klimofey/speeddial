# Flanking world clocks + permission UX — design

**Date:** 2026-05-24
**Status:** approved
**Builds on:** the SpeedDial MV3 extension (feat/speeddial-mvp).

Two small, independent improvements:
1. Render world clocks flanking the main clock (half left, half right), smaller.
2. A clearer permission flow for "Find better image": check first, explain before
   prompting, and give actionable guidance on denial.

## 1. Flanking world clocks

### Split helper — `src/lib/time.ts`
- `splitWorldClocks<T>(clocks: T[]): { left: T[]; right: T[] }` →
  `left = clocks.slice(0, Math.ceil(n/2))`, `right = clocks.slice(Math.ceil(n/2))`.
  Pure, unit-tested (even, odd, empty).

### Layout — `src/components/NewTab.tsx`
- Replace the current `<Clock/>` + single `<WorldClocks/>` (stacked) with a
  centered **clock row**: `[WorldClocks left] [Clock] [WorldClocks right]`.
  ```
  <div class="clock-row">
    <WorldClocks clocks={left} format=... />
    <Clock name=... format=... />
    <WorldClocks clocks={right} format=... />
  </div>
  ```
  where `{ left, right } = splitWorldClocks(settings.worldClocks)`. Still gated by
  `settings.showClock`. `WorldClocks` already returns `null` for an empty list, so
  with no world clocks only the main clock shows, centered.

### Styling — `src/styles/global.css`
- `.clock-row { display: flex; align-items: center; justify-content: center; gap: 24px; flex-wrap: wrap; }`
- The flanking groups stack vertically and read smaller than the main clock:
  `.clock-row .world-clocks { flex-direction: column; gap: 6px; margin-top: 0; }`.
  Main clock-time stays 48px; world-clock-time stays 16px (already smaller).
- `WorldClocks` itself is unchanged (rendered twice with subsets). Two 1-second
  intervals is acceptable.

## 2. Permission UX for "Find better image"

### `src/lib/permissions.ts`
- Add `hasOriginPermission(pageUrl: string): Promise<boolean>` →
  `chrome.permissions.contains({ origins: [origin + '/*'] })`; false on
  invalid URL / missing API / throw. (`ensureOriginPermission` stays as-is.)

### `src/components/CardEditor.tsx` — a small flow instead of one shot
Replace the single-shot `findBetterImage` with a 3-state flow driven by
`scrapeStep: 'idle' | 'need-perm' | 'searching' | 'denied'` plus `scrapeMsg`:

- **"Find better image"** button (idle): on click → `hasOriginPermission(url)`.
  - granted → run the scrape directly (no prompt).
  - not granted → `scrapeStep = 'need-perm'` and show an explanation line:
    *"To fetch a better image, SpeedDial needs one-time access to `<host>`. Chrome will ask — click Allow."*
- In `need-perm` (and `denied`) state, show an **"Allow access"** button: on click →
  `ensureOriginPermission(url)`.
  - granted → run the scrape.
  - denied → `scrapeStep = 'denied'`, message:
    *"Access denied. Click 'Allow access' to try again, or grant it manually in chrome://extensions → SpeedDial → Details → Site access."*
- **Scrape** (shared): `scrapeBestImage(url)`; on a URL → store
  `StoredImage { data: imageUrl, source: 'url', srcUrl: imageUrl }` under a `meta-`
  ref, `setUploadRef(ref)`, `setMode('upload')`, message *"Found a better image ✓"*,
  `scrapeStep = 'idle'`. On null → message *"No better image found."*, step idle.
- `busy` is set during the async calls and cleared at each terminal state.

`<host>` is `new URL(normalizeUrl(url)).host`.

## 3. Error handling

| Situation | Behavior |
|---|---|
| Permission already granted | Skip the prompt, scrape immediately |
| `hasOriginPermission` throws / no API | treated as not-granted → explanation shown |
| User denies the Chrome prompt | `denied` state with retry + manual-path guidance |
| Scrape returns null / throws | "No better image found.", back to idle |

## 4. Testing

- `time.ts`: `splitWorldClocks` — 4→[2,2], 3→[2,1], 0→[[],[]].
- `permissions.ts`: `hasOriginPermission` — calls `contains` with the right origin
  pattern; true/false/invalid-URL paths.
- `CardEditor` (mocking `hasOriginPermission`, `ensureOriginPermission`,
  `scrapeBestImage`):
  - already-granted → clicking "Find better image" scrapes directly and saving
    yields a `meta-` imageRef;
  - not-granted → click shows "Allow access"; clicking it (granted) scrapes;
  - denied → "Allow access" with permission denied shows the guidance message.
- `NewTab`: existing tests still pass (no world clocks by default → only the main
  clock renders inside `.clock-row`).

## 5. Out of scope

- A full modal permission wizard (lightweight inline flow chosen).
- Per-clock manual left/right assignment (auto half/half split).
- Sharing one timer across the two WorldClocks instances (negligible cost).
