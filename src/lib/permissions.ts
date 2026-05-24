export const GOOGLE_SUGGEST_ORIGIN = 'https://suggestqueries.google.com/*';

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
