import { describe, it, expect } from 'vitest';
import { mockChrome } from './setup';
import * as storage from '../src/lib/storage';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';
import { Dial } from '../src/lib/types';

const dial = (id: string, order: number): Dial => ({
  id, url: `https://${id}.com`, title: id, imageRef: 'favicon', color: '#000', order,
});

describe('storage', () => {
  it('returns default settings when nothing is stored', async () => {
    expect(await storage.getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips settings through sync', async () => {
    await storage.setSettings({ ...DEFAULT_SETTINGS, showRecent: false });
    expect((await storage.getSettings()).showRecent).toBe(false);
  });

  it('seeds the default clock widget when nothing is stored', async () => {
    const dials = await storage.getDials();
    expect(dials).toHaveLength(1);
    expect(dials[0].widget?.type).toBe('clock');
  });

  it('returns an empty list when dials are explicitly stored as []', async () => {
    await storage.setDials([]);
    expect(await storage.getDials()).toEqual([]);
  });

  it('round-trips dials through sync', async () => {
    await storage.setDials([dial('a', 0), dial('b', 1)]);
    const got = await storage.getDials();
    expect(got.map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('stores and reads images from local', async () => {
    await storage.setImage('img1', { data: 'data:x', source: 'upload' });
    expect((await storage.getImage('img1'))?.data).toBe('data:x');
    expect(await storage.getImage('missing')).toBeNull();
  });

  it('deletes images from local', async () => {
    await storage.setImage('img1', { data: 'data:x', source: 'upload' });
    await storage.deleteImage('img1');
    expect(await storage.getImage('img1')).toBeNull();
  });

  it('falls back to local when sync.set rejects (quota)', async () => {
    mockChrome.sync.set.mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'));
    await storage.setDials([dial('a', 0)]);
    expect((await storage.getDials()).map((d) => d.id)).toEqual(['a']);
  });

  it('rethrows non-quota errors from sync.set', async () => {
    mockChrome.sync.set.mockRejectedValueOnce(new Error('Missing host permission'));
    await expect(storage.setDials([dial('a', 0)])).rejects.toThrow(/permission/i);
  });

  it('defaults a missing dial size to 1x1 and preserves an existing size', async () => {
    await chrome.storage.sync.set({ dials: [
      { id: 'a', url: 'https://a.com', title: 'a', imageRef: 'favicon', color: '#000', order: 0 },
      { id: 'b', url: 'https://b.com', title: 'b', imageRef: 'favicon', color: '#000', order: 1, size: { w: 2, h: 2 } },
    ] });
    const got = await storage.getDials();
    expect(got[0].size).toEqual({ w: 1, h: 1 });
    expect(got[1].size).toEqual({ w: 2, h: 2 });
  });
});
