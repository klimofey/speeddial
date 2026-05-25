# Rendered page scrape (JS/SPA logos) — design

**Date:** 2026-05-25
**Status:** approved
**Builds on:** the icon-candidate flow in `CardEditor` + `metascrape.scrapeImages`.

## Problem
`scrapeImages` only sees the **static** HTML from `fetch()`. React/SPA sites render their
logo (often an inline `<svg>`) via JS after load, so it never appears in the fetched HTML.

## Approach (approved)
Render the page for real: open it in a **background tab**, let its JS run, read the live
DOM with `chrome.scripting.executeScript`, then close the tab. Needs the `scripting`
permission + host permission for the URL (already requested via `ensureOriginPermission`).

## 1. Engine — `src/lib/renderscrape.ts`
- `scrapeRendered(pageUrl): Promise<string[]>`
  - Feature-detect `chrome.scripting?.executeScript` + `chrome.tabs?.create` → `[]` if absent.
  - `chrome.tabs.create({ url, active: false })` → wait for the tab to reach `status:'complete'`
    via `chrome.tabs.onUpdated`, then a short hydration delay (~1200 ms) for SPA JS; hard
    timeout ~8 s.
  - `chrome.scripting.executeScript({ target:{tabId}, func: extractInPage })` → take
    `results[0].result` (string[]).
  - `finally`: `chrome.tabs.remove(tabId)` (always, best-effort).
  - All wrapped so any failure resolves to `[]` (never throws).
- `extractInPage()` — self-contained (runs in the page, no module references): collects
  og/twitter `meta`, icon/apple-touch/mask-icon `link`, inline `background-image` `url()`,
  logo-sized inline `<svg>` → `data:image/svg+xml` (tiny icons skipped, capped), and
  `img[src]`; resolves to absolute against `location.href`, de-dupes, caps (~14).

## 2. Manifest — `manifest.config.ts`
Add `'scripting'` to `permissions`. (No `tabs` permission needed — create/remove/onUpdated
`status` work without it. Host permission for the page is already requested at scrape time.)

## 3. Wiring — `src/components/CardEditor.tsx`
In `doScrape(base)`, after the static `scrapeImages` merge, also `await scrapeRendered(url)`
and merge any new candidates (host permission is already granted when `doScrape` runs). The
existing "searching" status covers both phases; the final "found N more" counts the union.

## 4. Tests
- `test/render-scrape.test.ts`: with mocked `chrome.tabs`/`chrome.scripting` (+ fake timers) —
  opens a tab, waits for complete, executes, returns the result, and removes the tab even on
  error; returns `[]` when the APIs are absent.
- `extractInPage`: run directly against a jsdom document (meta/icon/bg/svg/img extraction,
  tiny-svg skip, dedupe).
- `test/setup.ts`: add `chrome.tabs` (create/remove/onUpdated) and `chrome.scripting`
  (executeScript) to the mock + export.

## 5. Out of scope
- Rendering for previews/screenshots (only icon candidate discovery).
- Caching rendered results.
