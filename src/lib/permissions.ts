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
