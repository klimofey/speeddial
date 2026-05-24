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
