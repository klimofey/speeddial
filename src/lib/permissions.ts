export const GOOGLE_SUGGEST_ORIGIN = 'https://suggestqueries.google.com/*';

export async function ensureGooglePermission(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.request) return false;
  try {
    return await chrome.permissions.request({ origins: [GOOGLE_SUGGEST_ORIGIN] });
  } catch {
    return false;
  }
}
