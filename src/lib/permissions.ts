export const GOOGLE_SUGGEST_ORIGIN = 'https://suggestqueries.google.com/*';
export const MYMEMORY_ORIGIN = 'https://api.mymemory.translated.net/*';

export async function ensureMyMemoryPermission(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.request) return false;
  try {
    if (await chrome.permissions.contains({ origins: [MYMEMORY_ORIGIN] })) return true;
    return await chrome.permissions.request({ origins: [MYMEMORY_ORIGIN] });
  } catch {
    return false;
  }
}

// Requests host permission needed to FETCH an image's bytes (for canvas readback).
// Includes the gstatic CDN that Google's favicon endpoint redirects to — a
// cross-origin redirect needs the target origin's permission too.
export async function ensureImageFetchPermission(url: string): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.request) return false;
  let origins: string[];
  try {
    const u = new URL(url);
    origins = [u.origin + '/*'];
    if (/(^|\.)google\.com$/i.test(u.hostname)) origins.push('https://*.gstatic.com/*');
  } catch {
    return false;
  }
  try {
    return await chrome.permissions.request({ origins });
  } catch {
    return false;
  }
}

export async function hasBookmarksPermission(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.contains) return false;
  try { return await chrome.permissions.contains({ permissions: ['bookmarks'] }); } catch { return false; }
}

export async function ensureBookmarksPermission(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.request) return false;
  try { return await chrome.permissions.request({ permissions: ['bookmarks'] }); } catch { return false; }
}

export async function hasTabGroupsPermission(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.contains) return false;
  try { return await chrome.permissions.contains({ permissions: ['tabGroups', 'tabs'] }); } catch { return false; }
}

export async function ensureTabGroupsPermission(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.request) return false;
  try { return await chrome.permissions.request({ permissions: ['tabGroups', 'tabs'] }); } catch { return false; }
}

export async function ensureGooglePermission(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.request) return false;
  try {
    return await chrome.permissions.request({ origins: [GOOGLE_SUGGEST_ORIGIN] });
  } catch {
    return false;
  }
}

export async function ensureOriginPermission(pageUrl: string): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.request) return false;
  let pattern: string;
  try {
    pattern = new URL(pageUrl).origin + '/*';
  } catch {
    return false;
  }
  try {
    return await chrome.permissions.request({ origins: [pattern] });
  } catch {
    return false;
  }
}

export async function hasOriginPermission(pageUrl: string): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.contains) return false;
  let pattern: string;
  try {
    pattern = new URL(pageUrl).origin + '/*';
  } catch {
    return false;
  }
  try {
    return await chrome.permissions.contains({ origins: [pattern] });
  } catch {
    return false;
  }
}
