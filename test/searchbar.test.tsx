import { describe, it, expect } from 'vitest';
import { searchUrl } from '../src/components/SearchBar';

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
