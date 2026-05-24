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
    await storage.setSettings({ ...DEFAULT_SETTINGS, greetingName: 'Alex' });
    expect((await storage.getSettings()).greetingName).toBe('Alex');
  });

  it('returns [] for dials when nothing is stored', async () => {
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
});
