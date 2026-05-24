# Icon services in the gallery + quiet default preview — design

**Date:** 2026-05-25
**Status:** approved
**Builds on:** the "Find better image" gallery (CardEditor) of the SpeedDial MV3 extension.

## Problem

Scraped page images are often pixelated, and the default card preview tries
`apple-touch-icon` first — which 404s (console noise) on sites that lack it.
We want crisp, reliable icon options in the picker, and a quiet default.

## 1. Quiet default preview — `src/lib/images.ts` + `CardThumb`

- Drop `apple-touch-icon` from the **automatic** preview cascade. `faviconPreview`
  becomes `{ kind: 'favicon', src: faviconUrl(pageUrl, 128) }` (Chrome's `_favicon`
  endpoint returns a generic icon rather than 404ing, so no console noise).
- Remove the now-unused `appleTouchIconUrl` export. The favicon `Preview` keeps its
  optional `next?` field (now unset); `CardThumb.onImgError` therefore falls
  straight to the letter tile when a favicon image fails (rare).
- (The page's real `apple-touch-icon` is still offered in the gallery, because
  `scrapeImages` collects `link[rel~="apple-touch-icon"]`.)

## 2. Icon-service candidates — `src/lib/metascrape.ts`

Add `iconSources(pageUrl: string): string[]` — domain-derived, **no fetch, no host
permission** (these are just `<img src>` URLs):
- `https://www.google.com/s2/favicons?domain=<host>&sz=256`
- `https://icons.duckduckgo.com/ip3/<host>.ico`
- `https://icon.horse/icon/<host>`

Returns `[]` for an invalid URL / empty host. All keyless. Privacy: these reveal the
domain to the respective service, but only when the user explicitly clicks
"Find better image".

## 3. CardEditor flow — icons instantly, page scrape optional

When the user clicks **"Find better image"**:
1. Immediately populate the gallery with `iconSources(url)` — **no permission
   needed** — so crisp brand/icon options appear at once. Message:
   "Pick an icon, or allow page access to scan the page for more."
2. Check `hasOriginPermission`:
   - granted → scrape the page and **append** results to the icon candidates;
   - not granted → show the **"Allow access"** button (the icon candidates stay
     visible). Clicking it runs `ensureOriginPermission`; on grant → scrape +
     append; on denial → the existing guidance message.
- `doScrape(base)` merges `scrapeImages(url)` onto `base` (de-duped, icons first,
  then page images) and updates the message ("Found N more on the page — pick one."
  / "No extra images on the page."). No auto-pick.
- Picking a candidate (`selectCandidate`) is unchanged: store
  `StoredImage { data: url, source: 'url', srcUrl: url }` under a `meta-` ref,
  select it, live preview updates. Broken thumbnails still hide on `onError`.

## 4. Error handling

| Situation | Behavior |
|---|---|
| Invalid URL | `iconSources` → `[]`; "Find better image" shows nothing to pick + permission prompt for scrape |
| An icon-service URL 404s/blocked | that thumbnail hides (`onError`), others remain |
| Page scrape denied | icon candidates still usable; denial guidance shown |
| Default favicon image fails | `CardThumb` → letter tile |

## 5. Testing

- `images.ts`: `faviconPreview` returns a favicon@128 `src` and **no** apple-touch;
  `appleTouchIconUrl` is gone (remove its test).
- `CardThumb`: favicon image error → letter (single step now); image/letter render
  unchanged.
- `DialCard`: drop the old two-step apple-touch cascade test (now covered by
  `CardThumb`); other DialCard tests unchanged.
- `metascrape.ts`: `iconSources` builds the three service URLs from the host and
  returns `[]` for an invalid URL.
- `CardEditor`: clicking "Find better image" shows the icon candidates immediately
  (no "Allow access" needed to see them); "Allow access" then appends scraped page
  images; picking a candidate yields a `meta-` imageRef on save; denial shows guidance.

## 6. Recent row: center + fill

- The Recent strip currently left-aligns its pills, which looks off-center under the
  now-wide grid. Center them: `.recent-tiles { justify-content: center; }`.
- "Fill as much as possible": raise the recent count so the row uses the wider
  layout — `NewTab` calls `getRecentSites({ excludeUrls, limit: 16 })` (was the
  default 8). With `flex-wrap`, the centered pills fill the available width and wrap.
- Test: `recent.ts` already covers the `limit` option; no new logic. The center is
  CSS-only.

## 7. Out of scope

- Keyed services (logo.dev/Clearbit) — avoided to keep zero-config.
- Sorting candidates by resolution / fetching dimensions (user eyeballs the gallery).
- Self-made screenshots (platform-infeasible silently; documented separately).
