# Recent Row + Search Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a history-derived "Recent" row (with pin-to-persistent) and a search-suggestions dropdown (DuckDuckGo default, opt-in Google) to the SpeedDial new tab.

**Architecture:** Two new pure logic modules (`recent.ts` ranks `chrome.history`; `suggest.ts` fetches provider suggestions) plus a tiny `permissions.ts` for the runtime Google host-permission. New `RecentRow` component and an extended `SearchBar` consume them; `NewTab` wires Recent → `addDial`, and `Settings` gains a "show recent" toggle and a suggestions-provider select. All logic is unit-tested against mocked `chrome.*`/`fetch`.

**Tech Stack:** TypeScript, Preact, Vite, @crxjs/vite-plugin, Vitest + @testing-library/preact. Reuses existing `images.faviconUrl`, `storage`, `AppState`.

---

## File Structure

```
src/lib/recent.ts        # NEW: getRecentSites() — rank/dedupe chrome.history
src/lib/suggest.ts       # NEW: fetchSuggestions(provider, q)
src/lib/permissions.ts   # NEW: ensureGooglePermission()
src/lib/types.ts         # MODIFY: + SuggestProvider, + Settings.showRecent/suggestProvider
src/lib/defaults.ts      # MODIFY: defaults for the two new settings
src/components/RecentRow.tsx   # NEW
src/components/SearchBar.tsx   # MODIFY: suggestions dropdown
src/components/Settings.tsx    # MODIFY: + show-recent toggle, + suggestions select
src/components/NewTab.tsx      # MODIFY: load recents, render RecentRow, onPin
manifest.config.ts       # MODIFY: + 'history', + optional_host_permissions
src/styles/global.css    # MODIFY: recent-row + suggestions styles
test/setup.ts            # MODIFY: + chrome.history & chrome.permissions mocks
```

---

## Task 1: Settings fields, SuggestProvider type, and chrome mocks

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/defaults.ts`, `test/setup.ts`

- [ ] **Step 1: Add `SuggestProvider` and Settings fields in `src/lib/types.ts`**

Add the type alias near the other unions (after `CardSize`):
```ts
export type SuggestProvider = 'off' | 'duckduckgo' | 'google';
```
Add two fields to the `Settings` interface (after `screenshotTemplate: string;`):
```ts
  showRecent: boolean;
  suggestProvider: SuggestProvider;
```

- [ ] **Step 2: Add defaults in `src/lib/defaults.ts`**

In `DEFAULT_SETTINGS`, after `screenshotTemplate: '',` add:
```ts
  showRecent: true,
  suggestProvider: 'duckduckgo',
```

- [ ] **Step 3: Extend the chrome mock in `test/setup.ts`**

Find the block that assigns `globalThis.chrome`. Replace it with this (adds `history` and `permissions`, and exports them):
```ts
const history = { search: vi.fn(async () => [] as Array<{ url?: string; title?: string; lastVisitTime?: number; visitCount?: number }>) };
const permissions = { request: vi.fn(async () => true), contains: vi.fn(async () => false) };

(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: { sync, local, onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
  runtime: { getURL: (p: string) => 'chrome-extension://test' + p },
  history,
  permissions,
};

export const mockChrome = { sync, local, history, permissions };
```
(The previous `mockChrome` export and the old `globalThis.chrome` assignment are replaced by the above — do not leave a duplicate.)

- [ ] **Step 4: Run the full suite to confirm no regression**

Run: `npm test`
Expected: existing 54 tests still PASS (no new tests yet; this is foundation).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/defaults.ts test/setup.ts
git commit -m "feat: add showRecent/suggestProvider settings and history/permissions mocks"
```

---

## Task 2: `recent.ts` — rank recent sites from history

**Files:**
- Create: `src/lib/recent.ts`
- Test: `test/recent.test.ts`

- [ ] **Step 1: Write the failing test `test/recent.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { mockChrome } from './setup';
import { getRecentSites } from '../src/lib/recent';

type H = { url?: string; title?: string; lastVisitTime?: number; visitCount?: number };

describe('getRecentSites', () => {
  it('dedupes by origin and sums visit counts', async () => {
    mockChrome.history.search.mockResolvedValueOnce([
      { url: 'https://a.com/one', title: 'A1', lastVisitTime: 100, visitCount: 2 },
      { url: 'https://a.com/two', title: 'A2', lastVisitTime: 300, visitCount: 3 },
      { url: 'https://b.com/', title: 'B', lastVisitTime: 200, visitCount: 1 },
    ] as H[]);
    const sites = await getRecentSites({ excludeUrls: [] });
    expect(sites).toHaveLength(2);
    const a = sites.find((s) => s.origin === 'https://a.com')!;
    expect(a.score).toBe(5);          // 2 + 3
    expect(a.url).toBe('https://a.com/two'); // most recent visit wins
  });

  it('ranks by score desc, tie-break by recency', async () => {
    mockChrome.history.search.mockResolvedValueOnce([
      { url: 'https://a.com/', title: 'A', lastVisitTime: 100, visitCount: 5 },
      { url: 'https://b.com/', title: 'B', lastVisitTime: 999, visitCount: 5 },
    ] as H[]);
    const sites = await getRecentSites({ excludeUrls: [] });
    expect(sites.map((s) => s.origin)).toEqual(['https://b.com', 'https://a.com']);
  });

  it('excludes pinned origins and the newtab page', async () => {
    mockChrome.history.search.mockResolvedValueOnce([
      { url: 'https://a.com/', title: 'A', lastVisitTime: 1, visitCount: 1 },
      { url: 'https://keep.com/', title: 'K', lastVisitTime: 2, visitCount: 1 },
      { url: 'chrome-extension://test/index.html', title: 'self', lastVisitTime: 3, visitCount: 9 },
    ] as H[]);
    const sites = await getRecentSites({ excludeUrls: ['https://a.com/dashboard'] });
    expect(sites.map((s) => s.origin)).toEqual(['https://keep.com']);
  });

  it('respects the limit', async () => {
    const items: H[] = Array.from({ length: 20 }, (_, i) => ({
      url: `https://s${i}.com/`, title: `S${i}`, lastVisitTime: i, visitCount: i + 1,
    }));
    mockChrome.history.search.mockResolvedValueOnce(items);
    expect(await getRecentSites({ excludeUrls: [], limit: 5 })).toHaveLength(5);
  });

  it('returns [] when history.search throws', async () => {
    mockChrome.history.search.mockRejectedValueOnce(new Error('no permission'));
    expect(await getRecentSites({ excludeUrls: [] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/recent.test.ts`
Expected: FAIL — cannot resolve `../src/lib/recent`.

- [ ] **Step 3: Create `src/lib/recent.ts`**

```ts
export interface RecentSite {
  url: string;
  title: string;
  origin: string;
  score: number;
}

const WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // last 14 days

interface Ranked extends RecentSite {
  lastVisit: number;
}

export async function getRecentSites(opts: { excludeUrls: string[]; limit?: number }): Promise<RecentSite[]> {
  if (typeof chrome === 'undefined' || !chrome.history?.search) return [];

  let items: Array<{ url?: string; title?: string; lastVisitTime?: number; visitCount?: number }>;
  try {
    items = await chrome.history.search({ text: '', startTime: Date.now() - WINDOW_MS, maxResults: 200 });
  } catch {
    return [];
  }

  const selfUrl = chrome.runtime?.getURL ? chrome.runtime.getURL('index.html') : '';
  const excludeOrigins = new Set<string>();
  for (const u of opts.excludeUrls) {
    try { excludeOrigins.add(new URL(u).origin); } catch { /* ignore unparseable */ }
  }

  const byOrigin = new Map<string, Ranked>();
  for (const it of items) {
    if (!it.url || it.url === selfUrl) continue;
    let origin: string;
    try { origin = new URL(it.url).origin; } catch { continue; }
    if (origin.startsWith('chrome')) continue; // chrome:// and chrome-extension://
    if (excludeOrigins.has(origin)) continue;

    const visit = it.lastVisitTime ?? 0;
    const count = it.visitCount ?? 1;
    const existing = byOrigin.get(origin);
    if (!existing) {
      byOrigin.set(origin, { url: it.url, title: it.title || origin, origin, score: count, lastVisit: visit });
    } else {
      existing.score += count;
      if (visit > existing.lastVisit) {
        existing.lastVisit = visit;
        existing.url = it.url;
        existing.title = it.title || existing.title;
      }
    }
  }

  return [...byOrigin.values()]
    .sort((a, b) => b.score - a.score || b.lastVisit - a.lastVisit)
    .slice(0, opts.limit ?? 8)
    .map(({ url, title, origin, score }) => ({ url, title, origin, score }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/recent.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/recent.ts test/recent.test.ts
git commit -m "feat: add recent-sites ranking from browser history"
```

---

## Task 3: `suggest.ts` — provider suggestions

**Files:**
- Create: `src/lib/suggest.ts`
- Test: `test/suggest.test.ts`

- [ ] **Step 1: Write the failing test `test/suggest.test.ts`**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchSuggestions } from '../src/lib/suggest';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(payload: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, json: async () => payload })));
}

describe('fetchSuggestions', () => {
  it('returns [] for off or empty query', async () => {
    expect(await fetchSuggestions('off', 'cat')).toEqual([]);
    expect(await fetchSuggestions('duckduckgo', '   ')).toEqual([]);
  });

  it('parses the [query, [list]] shape from duckduckgo', async () => {
    stubFetch(['cat', ['cat', 'cats', 'cat food']]);
    expect(await fetchSuggestions('duckduckgo', 'cat')).toEqual(['cat', 'cats', 'cat food']);
  });

  it('hits the duckduckgo endpoint', async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => ['x', ['x1']] }));
    vi.stubGlobal('fetch', f);
    await fetchSuggestions('duckduckgo', 'x y');
    expect(f.mock.calls[0][0]).toContain('duckduckgo.com/ac/');
    expect(f.mock.calls[0][0]).toContain('q=x%20y');
  });

  it('hits the google endpoint', async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => ['x', ['x1']] }));
    vi.stubGlobal('fetch', f);
    await fetchSuggestions('google', 'x');
    expect(f.mock.calls[0][0]).toContain('suggestqueries.google.com/complete/search');
  });

  it('caps at 8 results', async () => {
    stubFetch(['q', Array.from({ length: 20 }, (_, i) => `s${i}`)]);
    expect(await fetchSuggestions('duckduckgo', 'q')).toHaveLength(8);
  });

  it('returns [] on non-ok response or parse error', async () => {
    stubFetch(['q', ['a']], false);
    expect(await fetchSuggestions('duckduckgo', 'q')).toEqual([]);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    expect(await fetchSuggestions('duckduckgo', 'q')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/suggest.test.ts`
Expected: FAIL — cannot resolve `../src/lib/suggest`.

- [ ] **Step 3: Create `src/lib/suggest.ts`**

```ts
import { SuggestProvider } from './types';

const ENDPOINTS: Record<'duckduckgo' | 'google', (q: string) => string> = {
  duckduckgo: (q) => `https://duckduckgo.com/ac/?type=list&q=${encodeURIComponent(q)}`,
  google: (q) => `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`,
};

// Both providers return the OpenSearch shape: [query, [suggestion, ...]].
export async function fetchSuggestions(provider: SuggestProvider, query: string): Promise<string[]> {
  const q = query.trim();
  if (provider === 'off' || !q) return [];
  try {
    const res = await fetch(ENDPOINTS[provider](q));
    if (!res.ok) return [];
    const data: unknown = await res.json();
    const list = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
    return list.filter((s): s is string => typeof s === 'string').slice(0, 8);
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/suggest.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/suggest.ts test/suggest.test.ts
git commit -m "feat: add search-suggestion fetching for DuckDuckGo and Google"
```

---

## Task 4: `permissions.ts` — runtime Google host permission

**Files:**
- Create: `src/lib/permissions.ts`
- Test: `test/permissions.test.ts`

- [ ] **Step 1: Write the failing test `test/permissions.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { mockChrome } from './setup';
import { ensureGooglePermission, GOOGLE_SUGGEST_ORIGIN } from '../src/lib/permissions';

describe('ensureGooglePermission', () => {
  it('requests the google suggest origin and returns true when granted', async () => {
    mockChrome.permissions.request.mockResolvedValueOnce(true);
    expect(await ensureGooglePermission()).toBe(true);
    expect(mockChrome.permissions.request).toHaveBeenCalledWith({ origins: [GOOGLE_SUGGEST_ORIGIN] });
  });

  it('returns false when the user denies', async () => {
    mockChrome.permissions.request.mockResolvedValueOnce(false);
    expect(await ensureGooglePermission()).toBe(false);
  });

  it('returns false when the request throws', async () => {
    mockChrome.permissions.request.mockRejectedValueOnce(new Error('x'));
    expect(await ensureGooglePermission()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/permissions.test.ts`
Expected: FAIL — cannot resolve `../src/lib/permissions`.

- [ ] **Step 3: Create `src/lib/permissions.ts`**

```ts
export const GOOGLE_SUGGEST_ORIGIN = 'https://suggestqueries.google.com/*';

export async function ensureGooglePermission(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.request) return false;
  try {
    return await chrome.permissions.request({ origins: [GOOGLE_SUGGEST_ORIGIN] });
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/permissions.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/permissions.ts test/permissions.test.ts
git commit -m "feat: add runtime Google suggest host-permission helper"
```

---

## Task 5: `RecentRow` component

**Files:**
- Create: `src/components/RecentRow.tsx`
- Test: `test/recentrow.test.tsx`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Write the failing test `test/recentrow.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { RecentRow } from '../src/components/RecentRow';
import { RecentSite } from '../src/lib/recent';

const sites: RecentSite[] = [
  { url: 'https://a.com/x', title: 'A', origin: 'https://a.com', score: 5 },
  { url: 'https://b.com/', title: 'B', origin: 'https://b.com', score: 3 },
];

describe('RecentRow', () => {
  it('renders a tile per site', () => {
    render(<RecentRow sites={sites} onPin={() => {}} />);
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('B')).toBeTruthy();
  });

  it('renders nothing when empty', () => {
    const { container } = render(<RecentRow sites={[]} onPin={() => {}} />);
    expect(container.querySelector('.recent-row')).toBeNull();
  });

  it('calls onPin with the site when + is clicked', () => {
    const onPin = vi.fn();
    render(<RecentRow sites={sites} onPin={onPin} />);
    fireEvent.click(screen.getByLabelText('Pin A'));
    expect(onPin).toHaveBeenCalledWith(sites[0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/recentrow.test.tsx`
Expected: FAIL — cannot resolve `../src/components/RecentRow`.

- [ ] **Step 3: Create `src/components/RecentRow.tsx`**

```tsx
import { RecentSite } from '../lib/recent';
import { faviconUrl } from '../lib/images';

interface Props {
  sites: RecentSite[];
  onPin: (site: RecentSite) => void;
}

export function RecentRow({ sites, onPin }: Props) {
  if (!sites.length) return null;
  return (
    <div class="recent-row">
      <div class="recent-label">Recent</div>
      <div class="recent-tiles">
        {sites.map((s) => (
          <div class="recent-tile" key={s.origin}>
            <a class="recent-link" href={s.url}>
              <img class="recent-favicon" src={faviconUrl(s.url)} alt="" />
              <span class="recent-title">{s.title}</span>
            </a>
            <button class="recent-pin" aria-label={`Pin ${s.title}`} onClick={() => onPin(s)}>+</button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/recentrow.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Append styles to the END of `src/styles/global.css`**

```css
.recent-row { max-width: 920px; margin: 0 auto; padding: 4px 24px 0; }
.recent-label { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin-bottom: 8px; }
.recent-tiles { display: flex; gap: 10px; flex-wrap: wrap; }
.recent-tile { position: relative; display: flex; align-items: center; gap: 8px;
  background: var(--card-bg); border: var(--card-border); box-shadow: var(--card-shadow);
  backdrop-filter: var(--card-blur); border-radius: 999px; padding: 6px 12px 6px 10px; max-width: 200px; }
.recent-link { display: flex; align-items: center; gap: 8px; text-decoration: none; color: var(--fg); min-width: 0; }
.recent-favicon { width: 18px; height: 18px; border-radius: 4px; flex: 0 0 auto; }
.recent-title { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recent-pin { flex: 0 0 auto; border: none; cursor: pointer; width: 20px; height: 20px; border-radius: 50%;
  background: var(--accent); color: #fff; font-size: 13px; line-height: 1; }
```

- [ ] **Step 6: Commit**

```bash
git add src/components/RecentRow.tsx test/recentrow.test.tsx src/styles/global.css
git commit -m "feat: add RecentRow component with pin-to-persistent button"
```

---

## Task 6: `SearchBar` suggestions dropdown

**Files:**
- Modify: `src/components/SearchBar.tsx`
- Modify: `test/searchbar.test.tsx`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Replace `src/components/SearchBar.tsx` with the extended version**

```tsx
import { useState, useRef } from 'preact/hooks';
import { SearchEngine, SuggestProvider } from '../lib/types';
import { fetchSuggestions } from '../lib/suggest';

const ENGINES: Record<SearchEngine, (q: string) => string> = {
  google: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  duckduckgo: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
  bing: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
};

export function searchUrl(engine: SearchEngine, query: string): string {
  return ENGINES[engine](query);
}

interface Props {
  engine: SearchEngine;
  suggestProvider: SuggestProvider;
  onFilter: (text: string) => void;
}

export function SearchBar({ engine, suggestProvider, onFilter }: Props) {
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const go = (q: string) => {
    if (q.trim()) window.location.href = searchUrl(engine, q.trim());
  };

  const onInput = (e: Event) => {
    const v = (e.target as HTMLInputElement).value;
    setValue(v);
    onFilter(v);
    setActive(-1);
    if (timer.current) clearTimeout(timer.current);
    if (suggestProvider === 'off' || !v.trim()) {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(() => {
      void fetchSuggestions(suggestProvider, v).then(setSuggestions);
    }, 150);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setActive(-1);
    }
  };

  const submit = (e: Event) => {
    e.preventDefault();
    go(active >= 0 ? suggestions[active] : value);
  };

  return (
    <form class="searchbar" onSubmit={submit} autocomplete="off">
      <input
        placeholder="Search the web or filter your cards…"
        value={value}
        onInput={onInput}
        onKeyDown={onKeyDown}
      />
      {suggestions.length > 0 && (
        <ul class="suggestions">
          {suggestions.map((s, i) => (
            <li
              key={s}
              class={`suggestion${i === active ? ' active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); go(s); }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
```

- [ ] **Step 2: Replace `test/searchbar.test.tsx` with the extended version**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { searchUrl, SearchBar } from '../src/components/SearchBar';
import * as suggest from '../src/lib/suggest';

describe('searchUrl', () => {
  it('builds a Google query URL', () => {
    expect(searchUrl('google', 'cats')).toBe('https://www.google.com/search?q=cats');
  });
  it('builds a DuckDuckGo query URL', () => {
    expect(searchUrl('duckduckgo', 'a b')).toBe('https://duckduckgo.com/?q=a%20b');
  });
  it('builds a Bing query URL', () => {
    expect(searchUrl('bing', 'x')).toBe('https://www.bing.com/search?q=x');
  });
});

describe('SearchBar suggestions', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows suggestions after typing', async () => {
    vi.spyOn(suggest, 'fetchSuggestions').mockResolvedValue(['cats', 'cars', 'care']);
    render(<SearchBar engine="google" suggestProvider="duckduckgo" onFilter={() => {}} />);
    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'ca' } });
    await waitFor(() => expect(screen.getByText('cats')).toBeTruthy());
  });

  it('does not fetch when the provider is off', async () => {
    const spy = vi.spyOn(suggest, 'fetchSuggestions').mockResolvedValue(['x']);
    render(<SearchBar engine="google" suggestProvider="off" onFilter={() => {}} />);
    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'ca' } });
    await new Promise((r) => setTimeout(r, 200));
    expect(spy).not.toHaveBeenCalled();
  });

  it('highlights a suggestion with ArrowDown', async () => {
    vi.spyOn(suggest, 'fetchSuggestions').mockResolvedValue(['cats', 'cars']);
    render(<SearchBar engine="google" suggestProvider="duckduckgo" onFilter={() => {}} />);
    const input = screen.getByRole('textbox');
    fireEvent.input(input, { target: { value: 'ca' } });
    await waitFor(() => screen.getByText('cats'));
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByText('cats').className).toContain('active');
  });

  it('clears suggestions on Escape', async () => {
    vi.spyOn(suggest, 'fetchSuggestions').mockResolvedValue(['cats']);
    render(<SearchBar engine="google" suggestProvider="duckduckgo" onFilter={() => {}} />);
    const input = screen.getByRole('textbox');
    fireEvent.input(input, { target: { value: 'ca' } });
    await waitFor(() => screen.getByText('cats'));
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('cats')).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `npx vitest run test/searchbar.test.tsx`
Expected: PASS (3 searchUrl + 4 suggestion tests = 7).

- [ ] **Step 4: Append suggestions styles to the END of `src/styles/global.css`**

```css
.searchbar { position: relative; }
.suggestions { list-style: none; margin: 6px 0 0; padding: 6px; position: absolute; left: 0; right: 0;
  background: var(--card-bg, #fff); color: var(--card-fg, #1a1a1a); border: var(--card-border);
  box-shadow: var(--card-shadow); backdrop-filter: var(--card-blur); border-radius: 14px; z-index: 30; }
.suggestion { padding: 8px 14px; border-radius: 9px; cursor: pointer; font-size: 14px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; }
.suggestion.active, .suggestion:hover { background: color-mix(in srgb, var(--accent) 18%, transparent); }
```

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/SearchBar.tsx test/searchbar.test.tsx src/styles/global.css
git commit -m "feat: add suggestions dropdown to SearchBar"
```

---

## Task 7: Wire-up — manifest, Settings panel, NewTab; build

**Files:**
- Modify: `manifest.config.ts`, `src/components/Settings.tsx`, `src/components/NewTab.tsx`

- [ ] **Step 1: Update `manifest.config.ts`**

Change the `permissions` array to add `'history'`, and add `optional_host_permissions` after `chrome_url_overrides`:
```ts
  permissions: ['storage', 'unlimitedStorage', 'favicon', 'history'],
  chrome_url_overrides: { newtab: 'index.html' },
  optional_host_permissions: ['https://suggestqueries.google.com/*'],
  icons: {
```
(Keep the existing `icons` block intact directly after.)

- [ ] **Step 2: Update `src/components/Settings.tsx`**

Add to the type import line so it also imports `SuggestProvider`:
```ts
import { Settings as SettingsType, Theme, SearchEngine, CardSize, Background, SuggestProvider } from '../lib/types';
```
Add this import after the existing storage/images imports:
```ts
import { ensureGooglePermission } from '../lib/permissions';
```
Inside the component body, after the existing `addCustom` handler, add:
```tsx
  const onSuggestChange = async (e: Event) => {
    const v = (e.target as HTMLSelectElement).value as SuggestProvider;
    if (v === 'google') {
      const ok = await ensureGooglePermission();
      onChange({ suggestProvider: ok ? 'google' : 'duckduckgo' });
    } else {
      onChange({ suggestProvider: v });
    }
  };
```
In the JSX, insert this block immediately BEFORE the `<label>Backup</label>` line:
```tsx
        <label>
          <input type="checkbox" checked={settings.showRecent}
            onChange={(e) => onChange({ showRecent: (e.target as HTMLInputElement).checked })} /> Show recent sites
        </label>

        <label for="se-suggest">Search suggestions</label>
        <select id="se-suggest" value={settings.suggestProvider} onChange={onSuggestChange}>
          <option value="off">Off</option>
          <option value="duckduckgo">DuckDuckGo</option>
          <option value="google">Google</option>
        </select>
        <p class="settings-warn">⚠ Suggestions send what you type to the chosen provider. DuckDuckGo needs no extra permission; Google asks for one.</p>
```

- [ ] **Step 3: Update `src/components/NewTab.tsx`**

Add imports (after the existing `getImage` import and component imports):
```tsx
import { getRecentSites, RecentSite } from '../lib/recent';
import { RecentRow } from './RecentRow';
```
Inside `Board`, after the `const [showSettings, setShowSettings] = useState(false);` line, add recent state:
```tsx
  const [recentSites, setRecentSites] = useState<RecentSite[]>([]);
```
After the existing theme `useEffect` blocks (before `if (!ready) return null;`), add:
```tsx
  // Load recent sites (excluding what's already pinned) when enabled.
  useEffect(() => {
    if (!ready || !settings.showRecent) { setRecentSites([]); return; }
    void getRecentSites({ excludeUrls: dials.map((d) => d.url) }).then(setRecentSites);
  }, [ready, settings.showRecent, dials]);
```
Add the pin handler next to `onSave` (after the `onSave` definition):
```tsx
  const onPinRecent = async (site: RecentSite) => {
    await addDial({ url: site.url, title: site.title });
  };
```
In the returned JSX, update the `<SearchBar>` to pass the provider, and add `<RecentRow>` right after the `</div>` that closes `.header` and before `<DialGrid ...>`:
```tsx
      <div class="header">
        {settings.showClock && <Clock name={settings.greetingName} />}
        <SearchBar engine={settings.searchEngine} suggestProvider={settings.suggestProvider} onFilter={setFilter} />
      </div>
      {!filter && <RecentRow sites={recentSites} onPin={onPinRecent} />}
      <DialGrid dials={visible} settings={settings} onEdit={(d) => setEditing(d)} onDelete={removeDial} onReorder={reorderDials} />
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all PASS (existing NewTab/Settings tests unaffected: `chrome.history.search` mock returns `[]`, so RecentRow renders nothing; SearchBar gets `suggestProvider` from default settings and only fetches on typing).

- [ ] **Step 5: Type-check and build**

Run: `npx tsc --noEmit`
Expected: 0 errors.
Run: `npm run build`
Expected: clean `dist/`; `dist/manifest.json` includes `"history"` in permissions and `optional_host_permissions` with the google suggest origin. Confirm with `grep -A2 optional_host dist/manifest.json` and `grep history dist/manifest.json`. Confirm no stray `.js` with `find src test -name '*.js'` (empty).

- [ ] **Step 6: Commit**

```bash
git add manifest.config.ts src/components/Settings.tsx src/components/NewTab.tsx
git commit -m "feat: wire Recent row and suggestions provider into NewTab and Settings"
```

- [ ] **Step 7: Update README privacy section**

In `README.md`, under `## Privacy`, add these two bullets:
```markdown
- Recent row: reads `chrome.history` locally to rank recently-popular sites; this
  data is never sent anywhere. Toggle off with "Show recent sites".
- Search suggestions: when enabled, the text you type is sent to the chosen
  provider (DuckDuckGo by default; Google is opt-in and asks for a host
  permission at the moment you switch to it). Set suggestions to "Off" to disable.
```
Commit:
```bash
git add README.md
git commit -m "docs: note recent-history and suggestions privacy behavior"
```

- [ ] **Step 8: Push**

```bash
git push origin feat/speeddial-mvp
```

---

## Self-Review Notes

- **Spec coverage:** Recent ranking/dedupe/exclude/limit/fail-soft (Task 2); suggestions DDG+Google parse/cap/fail-soft + off (Task 3); runtime Google permission (Task 4); RecentRow UI + pin (Task 5); SearchBar dropdown + keyboard (Task 6); manifest `history` + `optional_host_permissions`, Settings toggle+select with permission request/revert, NewTab wiring + pin→addDial→exclude, README privacy (Task 7); settings fields + chrome mocks (Task 1). All spec sections map to a task.
- **Type consistency:** `SuggestProvider` ('off'|'duckduckgo'|'google') defined in Task 1, used in `suggest.ts`, `SearchBar`, `Settings`. `RecentSite { url,title,origin,score }` defined in Task 2, imported by `RecentRow` (Task 5) and `NewTab` (Task 7). `getRecentSites({ excludeUrls, limit? })` signature consistent across Task 2 and its caller in Task 7. `fetchSuggestions(provider, query)` consistent Task 3 ↔ Task 6. `ensureGooglePermission()`/`GOOGLE_SUGGEST_ORIGIN` consistent Task 4 ↔ Task 7.
- **Placeholder scan:** none.
- **Risk flagged for manual verify:** DuckDuckGo's `ac` endpoint is expected to send permissive CORS; if a future change breaks that, `fetchSuggestions` fails soft (returns `[]`) — suggestions simply won't show, nothing breaks. Verify live in Chrome.
```
