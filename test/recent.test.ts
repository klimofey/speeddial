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
    expect(a.score).toBe(5);
    expect(a.url).toBe('https://a.com/two');
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
