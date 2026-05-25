import { Dial, Settings, StoredImage } from './types';
import { getImage, setImage } from './storage';
import { colorForKey, initialFor } from './color';

export type Preview =
  | { kind: 'image'; src: string }
  | { kind: 'favicon'; src: string; next?: string }
  | { kind: 'letter'; letter: string; color: string };

export function faviconUrl(pageUrl: string, size = 64): string {
  const base = chrome.runtime.getURL('/_favicon/');
  return `${base}?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`;
}

// Default favicon preview: Chrome's 128px favicon (returns a generic icon rather
// than 404ing). Crisp alternatives are offered on demand in the editor gallery.
function faviconPreview(pageUrl: string): Preview {
  return { kind: 'favicon', src: faviconUrl(pageUrl, 128) };
}

// Reads a File into a data URL (used by the upload flow in CardEditor).
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Fetches a remote image (or passes a data: URL through) and returns it as a data URL.
// Cross-origin fetches need host permission (extensions bypass CORS with it).
export async function urlToDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Fetches a remote image, stores it as a data URL in local, and returns its imageRef key.
export async function cacheImageFromUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const blob = await res.blob();
  const data: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const ref = 'url-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const stored: StoredImage = { data, source: 'url', srcUrl: url };
  await setImage(ref, stored);
  return ref;
}

// Decides what to render for a card's preview. Cascade: stored image -> screenshot ->
// favicon -> letter+color. The component handles runtime <img> errors by re-requesting
// the next tier (favicon, then letter).
export async function resolvePreview(dial: Dial, settings: Settings): Promise<Preview> {
  if (dial.imageRef === 'letter') {
    return { kind: 'letter', letter: initialFor(dial.title, dial.url), color: dial.color || colorForKey(dial.url) };
  }
  if (dial.imageRef === 'screenshot') {
    if (settings.useScreenshots && settings.screenshotTemplate) {
      return { kind: 'image', src: settings.screenshotTemplate.replace('{url}', encodeURIComponent(dial.url)) };
    }
    return faviconPreview(dial.url);
  }
  if (dial.imageRef !== 'favicon') {
    const img = await getImage(dial.imageRef);
    if (img) return { kind: 'image', src: img.data };
  }
  return faviconPreview(dial.url);
}

export function letterFallback(dial: Dial): Preview {
  return { kind: 'letter', letter: initialFor(dial.title, dial.url), color: dial.color || colorForKey(dial.url) };
}
