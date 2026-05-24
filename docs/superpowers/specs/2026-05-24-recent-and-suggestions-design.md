# Recent row + Search suggestions — design

**Date:** 2026-05-24
**Status:** approved
**Builds on:** the existing SpeedDial MV3 extension (feat/speeddial-mvp).

## Goal

Two additions to the new-tab page:
1. A **Recent** row of recently-popular sites (computed locally from browser
   history) with a **+** button on each tile to pin it into the persistent cards.
2. **Search suggestions** in the search box — a dropdown from DuckDuckGo (default,
   no extra permission) or, opt-in, Google (runtime host permission).

Both honor the privacy posture: history is read and ranked locally and never
leaves the extension; suggestions send the typed query to the chosen provider and
can be turned off entirely.

## 1. Recent row

### Data — `src/lib/recent.ts`
- `getRecentSites(opts: { excludeUrls: string[]; limit?: number }): Promise<RecentSite[]>`
- Calls `chrome.history.search({ text: '', startTime: now - 14d, maxResults: 200 })`.
- `RecentSite = { url: string; title: string; origin: string; score: number }`.
- Pipeline: map each `HistoryItem` to its origin (via `new URL().origin`; skip
  unparseable and the extension's own newtab URL `chrome.runtime.getURL('index.html')`);
  **dedupe by origin**, keeping the most recent `title`/`url` and summing `visitCount`;
  drop origins whose URL or origin matches any `excludeUrls` (the pinned dials);
  `score = visitCount`; sort by score desc, tie-break `lastVisitTime` desc; take `limit` (default 8).
- If `chrome.history` is unavailable or throws, return `[]` (row hides itself).

### UI — `src/components/RecentRow.tsx`
- Props: `{ sites: RecentSite[]; onPin: (site: RecentSite) => void }`.
- Renders nothing when `sites` is empty.
- A labeled "Recent" strip: horizontal row of small tiles (favicon via
  `faviconUrl(url)` + title), each with a **+** button (`aria-label="Pin <title>"`)
  calling `onPin(site)`.
- `NewTab` owns the data: loads recent sites (excluding current dial URLs), and
  `onPin` calls `addDial({ url, title })`. After pinning, the site's origin is now
  in the dials' exclude set, so a refresh drops it from Recent.
- Gated by `settings.showRecent`.

## 2. Search suggestions

### Data — `src/lib/suggest.ts`
- `fetchSuggestions(provider: SuggestProvider, query: string): Promise<string[]>`
  where `SuggestProvider = 'off' | 'duckduckgo' | 'google'`.
- `'off'` or empty query → `[]`.
- `'duckduckgo'`: `fetch('https://duckduckgo.com/ac/?type=list&q=' + encodeURIComponent(q))`
  → response shape `[query, [s1, s2, ...]]` → return the array (capped at 8).
- `'google'`: `fetch('https://suggestqueries.google.com/complete/search?client=firefox&q=' + enc)`
  → same `[query, [...]]` shape → return array (capped at 8).
- Any fetch/parse error → `[]` (fail soft; never block typing).

### Permissions — `src/lib/permissions.ts`
- `GOOGLE_SUGGEST_ORIGIN = 'https://suggestqueries.google.com/*'`.
- `ensureGooglePermission(): Promise<boolean>` → `chrome.permissions.request({ origins: [GOOGLE_SUGGEST_ORIGIN] })`.
- Declared in manifest as `optional_host_permissions`, requested at runtime only
  when the user switches `suggestProvider` to `'google'`. If denied, Settings
  reverts the provider to `'duckduckgo'`.

### UI — `src/components/SearchBar.tsx` (extended)
- Adds a debounced (~150 ms) suggestions dropdown below the input.
- Keyboard: ↑/↓ move the highlighted suggestion, Enter searches the highlighted
  one (or the typed text if none highlighted), Esc closes the dropdown.
- Mouse: click a suggestion to search it.
- Web search still navigates to `searchUrl(engine, query)`; the existing live
  local card filter (`onFilter`) is unchanged.
- Receives `suggestProvider` via props.

## 3. Settings additions
- `Settings` type gains: `showRecent: boolean` (default `true`),
  `suggestProvider: SuggestProvider` (default `'duckduckgo'`).
- `Settings` panel: a "Show recent sites" checkbox and a "Search suggestions"
  select (Off / DuckDuckGo / Google). Choosing Google triggers
  `ensureGooglePermission()`; on denial, revert to DuckDuckGo. A privacy note
  explains suggestions send typed text to the provider.
- `SCHEMA_VERSION` stays `1`; new fields are additive and covered by the existing
  `{ ...DEFAULT_SETTINGS, ...stored }` merge, so old backups load fine.

## 4. Manifest
- Add `history` to `permissions`.
- Add `optional_host_permissions: ['https://suggestqueries.google.com/*']`.
- No other permission changes; default install stays free of host permissions.

## 5. Error handling
| Situation | Behavior |
|---|---|
| `chrome.history` missing / throws | `getRecentSites` returns `[]`; row hidden |
| Suggestion fetch fails / bad JSON | `fetchSuggestions` returns `[]`; typing unaffected |
| Google permission denied | Provider reverts to `duckduckgo`; note shown |
| All recent sites already pinned | Row hidden (empty) |

## 6. Testing
- `recent.ts`: mock `chrome.history.search` — verify origin dedupe, visitCount
  summing, exclusion of pinned URLs + newtab URL, ranking, limit, empty/throw → `[]`.
- `suggest.ts`: stub `fetch` — verify DDG and Google URL shapes, parsing of
  `[query,[...]]`, cap at 8, `'off'`/empty → `[]`, error → `[]`.
- `permissions.ts`: mock `chrome.permissions.request` — granted/denied paths.
- `RecentRow`: renders one tile per site, empty → nothing, **+** calls `onPin`.
- `SearchBar`: typing populates the dropdown (with `fetchSuggestions` mocked),
  ↑/↓ highlight, Enter navigates, Esc closes; `'off'` shows no dropdown.
- `chrome.history` and `chrome.permissions` mocks added to `test/setup.ts`.

## 7. Out of scope (YAGNI)
- Dismissing/blacklisting individual recent sites (only pin + the natural
  pinned-exclusion).
- Suggestions from the favicon/bookmarks; only the two web providers.
- Reordering or configuring the Recent count in the UI (fixed at 8).
