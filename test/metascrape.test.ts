import { describe, it, expect, vi, afterEach } from 'vitest';
import { scrapeBestImage } from '../src/lib/metascrape';

afterEach(() => vi.unstubAllGlobals());
function stubHtml(html: string, ok = true) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, text: async () => html })));
}

describe('scrapeBestImage', () => {
  it('prefers og:image and resolves a relative URL against the page', async () => {
    stubHtml('<html><head><meta property="og:image" content="/img/hero.png"><link rel="icon" href="/f.ico"></head></html>');
    expect(await scrapeBestImage('https://site.com/page')).toBe('https://site.com/img/hero.png');
  });
  it('falls back to apple-touch-icon when no og/twitter image', async () => {
    stubHtml('<html><head><link rel="apple-touch-icon" href="https://cdn.x/t.png"></head></html>');
    expect(await scrapeBestImage('https://site.com')).toBe('https://cdn.x/t.png');
  });
  it('returns null when nothing matches', async () => {
    stubHtml('<html><head></head></html>');
    expect(await scrapeBestImage('https://site.com')).toBeNull();
  });
  it('returns null on a non-ok response', async () => {
    stubHtml('x', false);
    expect(await scrapeBestImage('https://site.com')).toBeNull();
  });
  it('returns null on fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('net'); }));
    expect(await scrapeBestImage('https://site.com')).toBeNull();
  });
});
