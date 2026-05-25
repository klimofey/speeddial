# Previews, width & clock-in-edit — design

**Date:** 2026-05-24
**Status:** approved
**Builds on:** the dashboard grid (Part 1) of the SpeedDial MV3 extension.

Four independent, individually-shippable improvements:
1. Adaptive grid width (use wide screens).
2. Lightweight crisper icons (apple-touch-icon + larger favicon) — no new permissions.
3. Opt-in "Find better image" — scrape page meta for a hero image (per-site host permission, requested on click).
4. Move clock configuration out of the Settings modal into edit mode.

Per-breakpoint stored layouts are deliberately deferred until after the widget
model (Part 2), so they're built once on the generalized item model.

## 1. Adaptive grid width

- Change `.dial-grid` and `.recent-row` `max-width` from `920px` to `min(1600px, 94vw)`
  so wide displays show more columns (auto-fill adds them); narrow screens are
  unaffected. Pure CSS — no data or component change.

## 2. Lightweight crisper icons — `src/lib/images.ts`

- Add `appleTouchIconUrl(pageUrl): string` → `<origin>/apple-touch-icon.png`.
- The `favicon` preview becomes a two-step image with a fallback:
  `Preview` favicon variant gains an optional `next?: string`. For favicon mode,
  `resolvePreview` returns `{ kind: 'favicon', src: appleTouchIconUrl(url), next: faviconUrl(url, 128) }`.
- `DialCard.onImgError`: if the current preview is `favicon` and has `next`, swap to
  `{ kind: 'favicon', src: next }` (no further `next`); otherwise fall back to the
  letter tile. So the runtime chain is **apple-touch-icon → favicon@128 → letter**,
  all via `<img onError>` (no CORS, no permissions).
- `faviconUrl` keeps its `size` param; the favicon fallback requests `128`.

## 3. Opt-in "Find better image" — `src/lib/metascrape.ts` + CardEditor

- `metascrape.ts`: `scrapeBestImage(pageUrl: string): Promise<string | null>` —
  `fetch(pageUrl)`, parse the HTML with `DOMParser`, and pick the best image URL
  in priority order: `og:image` → `twitter:image` → `<link rel="apple-touch-icon">`
  → `<link rel="icon">`. Resolve relative URLs against `pageUrl`. Return `null` on
  fetch/parse failure or if nothing is found.
- `permissions.ts`: add `ensureOriginPermission(pageUrl): Promise<boolean>` →
  `chrome.permissions.request({ origins: [new URL(pageUrl).origin + '/*'] })`
  (declared as `optional_host_permissions: ['https://*/*', 'http://*/*']` so any
  single origin can be requested at runtime). Returns false on denial/error.
- `CardEditor`: a **"Find better image"** button (shown when a URL is present).
  On click: `ensureOriginPermission(url)`; if granted, `scrapeBestImage(url)`; if a
  URL comes back, store `StoredImage { data: imageUrl, source: 'url', srcUrl: imageUrl }`
  under a generated ref and set the card's `imageRef` to it (the image renders
  directly from its URL — `<img>` needs no CORS). On denial/empty/error, show a
  small inline message and keep the current preview. Privacy: the request fires
  only on this explicit click, only for that one site's origin.

## 4. Clock configuration in edit mode

- **Remove** from the Settings modal: the "Show clock" checkbox, "Clock format"
  select, "Greeting name" input, and the "World clocks" section. (Backup, theme,
  background, search, suggestions, card size, recent toggle stay in Settings.)
- New component `src/components/ClockSettings.tsx` — renders those controls
  (show-clock toggle, 12h/24h, greeting name, world-clock add/remove/label) given
  `{ settings, onChange }`. It reuses the existing `listTimeZones`/`labelForZone`.
- In **edit mode only**, `NewTab` shows a **"Clock"** trigger button (near the Edit
  toggle) that opens `ClockSettings` in the existing modal shell. Outside edit
  mode there is no clock-config UI — the clock just renders.
- Settings type is unchanged; the same fields are simply edited from a different place.

## 5. Manifest

- Add `optional_host_permissions: ['https://*/*', 'http://*/*']` (alongside the
  existing google-suggest entry — merge into one array) so item 3 can request a
  specific site origin at runtime. No host permissions are granted at install.

## 6. Error handling

| Situation | Behavior |
|---|---|
| apple-touch-icon 404 | `<img onError>` → favicon@128 → letter |
| `scrapeBestImage` fetch/parse fails or finds nothing | returns `null`; CardEditor shows "No better image found", keeps current preview |
| Origin permission denied | `ensureOriginPermission` false; CardEditor shows a note, no scrape |
| Scraped image URL later fails to load | DialCard `<img onError>` → favicon → letter (existing cascade) |

## 7. Testing

- `images.ts`: `appleTouchIconUrl` shape; favicon preview returns `src`
  (apple-touch-icon) + `next` (favicon@128).
- `DialCard`: a favicon preview whose `<img>` errors swaps to `next`, and a second
  error falls back to the letter tile.
- `metascrape.ts`: stub `fetch` with sample HTML — picks `og:image` over others,
  resolves a relative path, returns `null` on no-match and on fetch error.
- `permissions.ts`: `ensureOriginPermission` requests the right origin pattern;
  granted/denied paths.
- `CardEditor`: clicking "Find better image" (scrape mocked) sets an image
  `imageRef`; denied/empty path shows the message and leaves `imageRef` unchanged.
- `ClockSettings`: toggling show-clock / format / adding a world clock emits the
  right `onChange` patches.
- `Settings`: the clock controls are no longer present (e.g. no "Clock format"
  label); the remaining controls still work.

## 8. Out of scope

- Per-breakpoint stored layouts (after Part 2).
- A grid width/density setting (CSS adaptive width covers it for now).
- Caching scraped images to data URLs (we reference the URL directly).
