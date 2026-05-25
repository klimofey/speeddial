import { describe, it, expect } from 'vitest';
import * as storage from '../src/lib/storage';
import { buildSnapshot, serialize, parseSnapshot, restoreSnapshot } from '../src/lib/backup';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';
import { Dial } from '../src/lib/types';

const dial: Dial = { id: 'a', url: 'https://a.com', title: 'A', imageRef: 'img1', color: '#000', order: 0 };

describe('backup', () => {
  it('builds a snapshot from current storage', async () => {
    await storage.setSettings({ ...DEFAULT_SETTINGS, showRecent: false });
    await storage.setDials([dial]);
    await storage.setImage('img1', { data: 'data:x', source: 'upload' });
    const snap = await buildSnapshot();
    expect(snap.settings.showRecent).toBe(false);
    expect(snap.dials).toHaveLength(1);
    expect(snap.images.img1.data).toBe('data:x');
  });

  it('serializes to JSON when there are no images', async () => {
    await storage.setDials([{ ...dial, imageRef: 'favicon' }]);
    const out = await serialize(await buildSnapshot());
    expect(out.kind).toBe('json');
    expect(out.filename).toMatch(/\.json$/);
  });

  it('serializes to ZIP when images are present', async () => {
    await storage.setDials([dial]);
    await storage.setImage('img1', { data: 'data:image/png;base64,AAAA', source: 'upload' });
    const out = await serialize(await buildSnapshot());
    expect(out.kind).toBe('zip');
    expect(out.filename).toMatch(/\.zip$/);
    expect(out.blob.size).toBeGreaterThan(0);
  });

  it('round-trips a JSON snapshot', async () => {
    const snap = { schemaVersion: 1, settings: DEFAULT_SETTINGS, dials: [{ ...dial, imageRef: 'favicon' }], images: {} };
    const parsed = await parseSnapshot(new Blob([JSON.stringify(snap)], { type: 'application/json' }), 'b.json');
    expect(parsed.dials[0].id).toBe('a');
  });

  it('rejects an unknown schema version', async () => {
    const bad = new Blob([JSON.stringify({ schemaVersion: 999, settings: {}, dials: [], images: {} })]);
    await expect(parseSnapshot(bad, 'b.json')).rejects.toThrow(/version/i);
  });

  it('restores a snapshot into storage', async () => {
    const snap = { schemaVersion: 1, settings: { ...DEFAULT_SETTINGS, showRecent: false }, dials: [{ ...dial, imageRef: 'favicon' }], images: {} };
    await restoreSnapshot(snap);
    expect((await storage.getSettings()).showRecent).toBe(false);
    expect((await storage.getDials())[0].id).toBe('a');
  });
});
