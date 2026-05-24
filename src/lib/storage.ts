import { Settings, Dial, StoredImage } from './types';
import { DEFAULT_SETTINGS } from './defaults';

const K_SETTINGS = 'settings';
const K_DIALS = 'dials';
const IMG_PREFIX = 'img:';

// Write to sync; if the sync quota is exceeded, transparently fall back to local.
async function setSynced(key: string, value: unknown): Promise<void> {
  try {
    await chrome.storage.sync.set({ [key]: value });
    await chrome.storage.local.remove(key); // clear any stale fallback copy
  } catch {
    await chrome.storage.local.set({ [key]: value });
  }
}

// Read from sync first, then the local fallback, then the provided default.
async function getSynced<T>(key: string, fallback: T): Promise<T> {
  const s = await chrome.storage.sync.get(key);
  if (s[key] !== undefined) return s[key] as T;
  const l = await chrome.storage.local.get(key);
  if (l[key] !== undefined) return l[key] as T;
  return fallback;
}

export async function getSettings(): Promise<Settings> {
  const stored = await getSynced<Partial<Settings> | undefined>(K_SETTINGS, undefined);
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

export async function setSettings(settings: Settings): Promise<void> {
  await setSynced(K_SETTINGS, settings);
}

export async function getDials(): Promise<Dial[]> {
  const dials = await getSynced<Dial[]>(K_DIALS, []);
  return [...dials].sort((a, b) => a.order - b.order);
}

export async function setDials(dials: Dial[]): Promise<void> {
  await setSynced(K_DIALS, dials);
}

export async function getImage(ref: string): Promise<StoredImage | null> {
  const res = await chrome.storage.local.get(IMG_PREFIX + ref);
  return (res[IMG_PREFIX + ref] as StoredImage) ?? null;
}

export async function setImage(ref: string, image: StoredImage): Promise<void> {
  await chrome.storage.local.set({ [IMG_PREFIX + ref]: image });
}

export async function deleteImage(ref: string): Promise<void> {
  await chrome.storage.local.remove(IMG_PREFIX + ref);
}

export async function getAllImages(): Promise<Record<string, StoredImage>> {
  const all = await chrome.storage.local.get(null);
  const out: Record<string, StoredImage> = {};
  for (const [k, v] of Object.entries(all)) {
    if (k.startsWith(IMG_PREFIX)) out[k.slice(IMG_PREFIX.length)] = v as StoredImage;
  }
  return out;
}
