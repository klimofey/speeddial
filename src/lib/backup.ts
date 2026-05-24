import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { Snapshot, SCHEMA_VERSION } from './types';
import * as storage from './storage';
import { DEFAULT_SETTINGS } from './defaults';

export interface SerializedBackup {
  kind: 'json' | 'zip';
  filename: string;
  blob: Blob;
}

export async function buildSnapshot(): Promise<Snapshot> {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: await storage.getSettings(),
    dials: await storage.getDials(),
    images: await storage.getAllImages(),
  };
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function serialize(snap: Snapshot): Promise<SerializedBackup> {
  const hasImages = Object.keys(snap.images).length > 0;
  if (!hasImages) {
    return {
      kind: 'json',
      filename: `speeddial-backup-${dateStamp()}.json`,
      blob: new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' }),
    };
  }
  const files: Record<string, Uint8Array> = {};
  const meta = { schemaVersion: snap.schemaVersion, settings: snap.settings, dials: snap.dials };
  files['settings.json'] = strToU8(JSON.stringify(meta, null, 2));
  for (const [ref, img] of Object.entries(snap.images)) {
    files[`images/${ref}.json`] = strToU8(JSON.stringify(img));
  }
  const zipped = zipSync(files, { level: 6 });
  return {
    kind: 'zip',
    filename: `speeddial-backup-${dateStamp()}.zip`,
    blob: new Blob([zipped], { type: 'application/zip' }),
  };
}

function validate(snap: Snapshot): void {
  if (snap.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported backup version ${snap.schemaVersion}; this build expects ${SCHEMA_VERSION}.`);
  }
  if (!Array.isArray(snap.dials)) throw new Error('Invalid backup: missing dials.');
}

export async function parseSnapshot(blob: Blob, filename: string): Promise<Snapshot> {
  let snap: Snapshot;
  if (filename.toLowerCase().endsWith('.zip')) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    const files = unzipSync(buf);
    const meta = JSON.parse(strFromU8(files['settings.json']));
    const images: Snapshot['images'] = {};
    for (const [path, bytes] of Object.entries(files)) {
      if (path.startsWith('images/') && path.endsWith('.json')) {
        const ref = path.slice('images/'.length, -'.json'.length);
        images[ref] = JSON.parse(strFromU8(bytes));
      }
    }
    snap = { schemaVersion: meta.schemaVersion, settings: meta.settings, dials: meta.dials, images };
  } else {
    snap = JSON.parse(await blob.text());
  }
  validate(snap);
  return snap;
}

export async function restoreSnapshot(snap: Snapshot): Promise<void> {
  validate(snap);
  await storage.setSettings({ ...DEFAULT_SETTINGS, ...snap.settings });
  await storage.setDials(snap.dials);
  for (const [ref, img] of Object.entries(snap.images)) {
    await storage.setImage(ref, img);
  }
}
