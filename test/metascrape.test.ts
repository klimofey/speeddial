import { describe, it, expect, vi, afterEach } from 'vitest';
import { scrapeImages } from '../src/lib/metascrape';

afterEach(() => vi.unstubAllGlobals());
function stubHtml(html: string, ok = true) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, text: async () => html })));
}

describe('scrapeImages', () => {
  it('collects og/twitter/apple/icon/mask-icon and <img>, resolved + deduped, SVG kept', async () => {
    stubHtml(`<html><head>
      <meta property="og:image" content="/hero.png">
      <meta name="twitter:image" content="https://cdn.test/t.jpg">
      <link rel="apple-touch-icon" href="/touch.png">
      <link rel="icon" type="image/svg+xml" href="/favicon.svg">
      <link rel="mask-icon" href="/mask.svg">
    </head><body><img src="/a.png"><img src="/a.png"><img src="https://x.test/b.jpg"></body></html>`);
    const r = await scrapeImages('https://site.com/page');
    expect(r).toContain('https://site.com/hero.png');
    expect(r).toContain('https://cdn.test/t.jpg');
    expect(r).toContain('https://site.com/touch.png');
    expect(r).toContain('https://site.com/favicon.svg');
    expect(r).toContain('https://site.com/mask.svg');
    expect(r).toContain('https://site.com/a.png');
    expect(r).toContain('https://x.test/b.jpg');
    expect(r.filter((u) => u.endsWith('/a.png'))).toHaveLength(1);
    expect(r[0]).toBe('https://site.com/hero.png');
  });

  it('caps at 12', async () => {
    const imgs = Array.from({ length: 20 }, (_, i) => `<img src="/i${i}.png">`).join('');
    stubHtml(`<html><body>${imgs}</body></html>`);
    expect((await scrapeImages('https://s.com')).length).toBe(12);
  });

  it('returns [] when nothing matches', async () => {
    stubHtml('<html><head></head><body></body></html>');
    expect(await scrapeImages('https://s.com')).toEqual([]);
  });

  it('returns [] on a non-ok response', async () => {
    stubHtml('x', false);
    expect(await scrapeImages('https://s.com')).toEqual([]);
  });

  it('returns [] on fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('net'); }));
    expect(await scrapeImages('https://s.com')).toEqual([]);
  });
});
