import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as storage from '../src/lib/storage';
import { faviconUrl, resolvePreview, cacheImageFromUrl, fileToDataUrl } from '../src/lib/images';
import { Dial, Settings } from '../src/lib/types';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';

const dial = (over: Partial<Dial> = {}): Dial => ({
  id: 'a', url: 'https://github.com', title: 'GitHub', imageRef: 'favicon', color: '#000', order: 0, ...over,
});
const settings: Settings = { ...DEFAULT_SETTINGS };

beforeEach(() => { vi.restoreAllMocks(); });

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

  it('caches a fetched URL image into local storage', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => blob })));
    vi.spyOn(globalThis, 'FileReader').mockImplementation(function (this: any) {
      this.readAsDataURL = () => { this.result = 'data:cached'; this.onload?.(); };
    } as never);
    const ref = await cacheImageFromUrl('https://img/p.png');
    expect((await storage.getImage(ref))?.data).toBe('data:cached');
  });
});
