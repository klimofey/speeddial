import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrapeRendered, extractInPage } from '../src/lib/renderscrape';
import { mockChrome } from './setup';

describe('scrapeRendered', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('opens a background tab, runs extraction, returns results, closes the tab', async () => {
    mockChrome.tabs.create.mockResolvedValueOnce({ id: 7 });
    mockChrome.scripting.executeScript.mockResolvedValueOnce([{ result: ['https://x/logo.svg'] }]);
    const p = scrapeRendered('https://spa.example/');
    await vi.advanceTimersByTimeAsync(0);              // let tabs.create resolve + listener register
    mockChrome.tabs.onUpdated._emit(7, { status: 'complete' });
    await vi.advanceTimersByTimeAsync(1300);            // past the hydration delay
    await expect(p).resolves.toEqual(['https://x/logo.svg']);
    expect(mockChrome.tabs.remove).toHaveBeenCalledWith(7);
  });

  it('resolves to [] and still closes the tab when execution throws', async () => {
    mockChrome.tabs.create.mockResolvedValueOnce({ id: 9 });
    mockChrome.scripting.executeScript.mockRejectedValueOnce(new Error('no access'));
    const p = scrapeRendered('https://spa.example/');
    await vi.advanceTimersByTimeAsync(0);
    mockChrome.tabs.onUpdated._emit(9, { status: 'complete' });
    await vi.advanceTimersByTimeAsync(1300);
    await expect(p).resolves.toEqual([]);
    expect(mockChrome.tabs.remove).toHaveBeenCalledWith(9);
  });

  it('returns [] without throwing when scripting is unavailable', async () => {
    const c = globalThis as unknown as { chrome: { scripting?: unknown } };
    const saved = c.chrome.scripting;
    c.chrome.scripting = undefined;
    await expect(scrapeRendered('https://x/')).resolves.toEqual([]);
    c.chrome.scripting = saved;
  });
});

describe('extractInPage', () => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function add(tag: string, attrs: Record<string, string>, parent: Element) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    parent.appendChild(el);
    return el;
  }
  function addSvg(attrs: Record<string, string>) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
    svg.appendChild(document.createElementNS(SVG_NS, 'path'));
    document.body.appendChild(svg);
  }

  beforeEach(() => { document.head.replaceChildren(); document.body.replaceChildren(); });

  it('collects meta/icon/background/svg/img from the live DOM', () => {
    add('meta', { property: 'og:image', content: '/og.png' }, document.head);
    add('link', { rel: 'icon', href: '/fav.svg' }, document.head);
    add('a', { style: 'background-image: url(/logo.png)' }, document.body);
    addSvg({ viewBox: '0 0 1660 290', height: '22' }); // logo-sized → kept
    addSvg({ width: '16', height: '16' });             // tiny → skipped
    add('img', { src: '/pic.jpg' }, document.body);

    const r = extractInPage();
    const base = location.href;
    expect(r).toContain(new URL('/og.png', base).href);
    expect(r).toContain(new URL('/fav.svg', base).href);
    expect(r).toContain(new URL('/logo.png', base).href);
    expect(r).toContain(new URL('/pic.jpg', base).href);
    expect(r.filter((u) => u.startsWith('data:image/svg+xml'))).toHaveLength(1);
  });
});
