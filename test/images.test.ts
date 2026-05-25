import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as storage from '../src/lib/storage';
import { faviconUrl, resolvePreview, cacheImageFromUrl } from '../src/lib/images';
import { Dial, Settings } from '../src/lib/types';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';

const dial = (over: Partial<Dial> = {}): Dial => ({
  id: 'a', url: 'https://github.com', title: 'GitHub', imageRef: 'favicon', color: '#000', order: 0, ...over,
});
const settings: Settings = { ...DEFAULT_SETTINGS };

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('images', () => {
  it('builds an MV3 favicon URL', () => {
    const u = faviconUrl('https://github.com', 64);
    expect(u).toContain('/_favicon/');
    expect(u).toContain('pageUrl=');
    expect(u).toContain('size=64');
  });

  it('resolves a stored image into a data URL', async () => {
    await storage.setImage('a', { data: 'data:img', source: 'upload' });
    const r = await resolvePreview(dial({ imageRef: 'a' }), settings);
    expect(r).toEqual({ kind: 'image', src: 'data:img' });
  });

  it('resolves favicon mode to a favicon URL', async () => {
    const r = await resolvePreview(dial({ imageRef: 'favicon' }), settings);
    expect(r.kind).toBe('favicon');
  });

  it('resolves letter mode to an initial + color', async () => {
    const r = await resolvePreview(dial({ imageRef: 'letter', title: 'GitHub' }), settings);
    expect(r).toEqual({ kind: 'letter', letter: 'G', color: '#000' });
  });

  it('resolves screenshot mode when enabled', async () => {
    const r = await resolvePreview(
      dial({ imageRef: 'favicon', url: 'https://x.com' }),
      { ...settings, useScreenshots: true, screenshotTemplate: 'https://shot/{url}' },
    );
    expect(r.kind).toBe('favicon');
    const r2 = await resolvePreview(
      dial({ imageRef: 'screenshot', url: 'https://x.com' }),
      { ...settings, useScreenshots: true, screenshotTemplate: 'https://shot/{url}' },
    );
    expect(r2).toEqual({ kind: 'image', src: 'https://shot/https%3A%2F%2Fx.com' });
  });

  it('favicon preview uses a 128px Chrome favicon (no apple-touch)', async () => {
    const r = await resolvePreview(dial({ imageRef: 'favicon', url: 'https://github.com' }), settings);
    expect(r.kind).toBe('favicon');
    expect((r as { src: string }).src).toContain('/_favicon/');
    expect((r as { src: string }).src).toContain('size=128');
    expect((r as { src: string }).src).not.toContain('apple-touch-icon');
  });

  it('caches a fetched URL image into local storage', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => blob })));
    class FakeFileReader {
      result: string | null = null;
      error: unknown = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        this.result = 'data:cached';
        this.onload?.();
      }
    }
    vi.stubGlobal('FileReader', FakeFileReader);
    const ref = await cacheImageFromUrl('https://img/p.png');
    expect((await storage.getImage(ref))?.data).toBe('data:cached');
  });
});
