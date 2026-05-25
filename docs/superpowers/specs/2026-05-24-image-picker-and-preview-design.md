# Image picker + card preview — design

**Date:** 2026-05-24
**Status:** approved
**Builds on:** the "Find better image" meta-scrape (CardEditor) of the SpeedDial MV3 extension.

## Problem

Today "Find better image" auto-picks one image by priority (og:image → … → icon).
When a page has no good og:image it falls back to a small icon → the card looks
pixelated, and the editor shows no preview to catch it. Users want to **see** the
current preview and **choose** among the images actually found on the page
(including SVGs).

## 1. Collect many candidates — `src/lib/metascrape.ts`

Replace `scrapeBestImage(pageUrl): Promise<string|null>` with
`scrapeImages(pageUrl): Promise<string[]>`:
- Fetch + `DOMParser` (unchanged fetch/parse error handling → returns `[]`).
- Collect, in this order:
  1. all `meta[property="og:image"]` / `meta[name="og:image"]` `content`
  2. `meta[name="twitter:image"]` / `meta[property="twitter:image"]` `content`
  3. all `link[rel~="apple-touch-icon"]` `href`
  4. all `link[rel~="icon"]` `href` (includes `type="image/svg+xml"`)
  5. all `link[rel="mask-icon"]` `href` (SVG)
  6. all `img[src]` `src` (page images, includes `.svg`)
- Resolve each against `pageUrl` (`new URL(candidate, pageUrl).href`); skip ones
  that fail to resolve and empty/blank values. **No filtering by file extension**
  (SVG kept). De-duplicate, preserving first-seen order. Cap at **12**.
- Returns `[]` on fetch/parse failure or no candidates.

## 2. Shared preview — `src/components/CardThumb.tsx` (new)

Extract the thumbnail rendering currently inline in `DialCard` into
`CardThumb({ dial, settings })`: runs `resolvePreview` in an effect and renders the
`image` / `favicon` (`.dial-favicon`) / `letter` (`.dial-letter`) variants with the
existing `onImgError` cascade (apple-touch → favicon → letter). It renders the inner
`.dial-thumb` content (same DOM/classes as today, so `DialCard` tests still pass).
- `DialCard` uses `<CardThumb dial settings />` for its thumb (keeps title, actions,
  resize handle, span styling around it).

## 3. CardEditor — live preview + candidate gallery

- **Live preview** at the top of the editor: a small box showing the current
  selection. If `mode === 'url'` with a typed `imageUrl`, render that URL directly
  (`<img>`); otherwise render `<CardThumb dial={previewDial} settings={settings} />`
  where `previewDial = { id:'preview', url: normalizeUrl(url), title, imageRef, color }`
  and `imageRef` reflects the editor state (`favicon`/`letter`/`screenshot` directly,
  or `uploadRef` for uploaded/scraped/picked images).
- **Candidate gallery:** "Find better image" (after the existing permission flow)
  now calls `scrapeImages(url)`:
  - `[]` → message "No images found on the page.";
  - otherwise → store the list in `candidates` state and show a **grid of clickable
    thumbnails** (message "Found N images — pick one"). No auto-pick.
  - Clicking a thumbnail → store `StoredImage { data: imageUrl, source: 'url', srcUrl: imageUrl }`
    under a generated `meta-` ref, `setUploadRef(ref)`, `setMode('upload')`, message
    "Selected ✓". The gallery stays open so another can be picked; the live preview
    updates immediately.
  - A candidate `<img>` that fails to load hides itself (`onError`).

The permission flow (check `hasOriginPermission` → "Allow access" →
`ensureOriginPermission` → denial guidance) is unchanged; it now gates `scrapeImages`.

## 4. Styling — `src/styles/global.css`

- `.ce-preview` box (centered thumbnail, fixed size ~96px) at the top of the modal.
- `.ce-candidates` grid of ~56px thumbnails (`object-fit: contain`), scrollable if
  many; `.ce-candidate.selected` highlights the chosen one.

## 5. Error handling

| Situation | Behavior |
|---|---|
| `scrapeImages` fetch/parse fails | returns `[]` → "No images found on the page." |
| A candidate thumbnail fails to load | that thumbnail hides (`onError`) |
| Picked image URL later fails on the card | DialCard/CardThumb cascade → favicon → letter |
| No URL entered | "Find better image" button hidden (as today) |

## 6. Testing

- `metascrape.ts`: `scrapeImages` collects og/twitter/apple/icon/mask-icon/`<img>`,
  keeps an SVG `link rel=icon`, resolves relative URLs, de-dupes, caps at 12,
  returns `[]` on no-match and on fetch error.
- `CardThumb`: renders image / favicon / letter; the favicon `<img>` error cascades
  apple-touch → favicon → letter (move the cascade test here).
- `DialCard`: existing tests still pass (CardThumb renders the same DOM).
- `CardEditor`: after "Allow access", a candidate gallery appears; clicking a
  candidate sets the image (`meta-` ref on save) and updates the live preview; the
  live preview reflects letter/favicon modes.

## 7. Out of scope

- Inline `<svg>` element serialization (only URL-referenced SVGs).
- Server-side image dimension detection / sorting by resolution (user eyeballs the
  gallery; order is meta/icons first, then page images).
- Caching picked remote images to data URLs (the URL is referenced directly).
