import { describe, it, expect } from 'vitest';
import { mockChrome } from './setup';
import { ensureGooglePermission, GOOGLE_SUGGEST_ORIGIN, ensureOriginPermission, hasOriginPermission } from '../src/lib/permissions';

describe('ensureGooglePermission', () => {
  it('requests the google suggest origin and returns true when granted', async () => {
    mockChrome.permissions.request.mockResolvedValueOnce(true);
    expect(await ensureGooglePermission()).toBe(true);
    expect(mockChrome.permissions.request).toHaveBeenCalledWith({ origins: [GOOGLE_SUGGEST_ORIGIN] });
  });

  it('returns false when the user denies', async () => {
    mockChrome.permissions.request.mockResolvedValueOnce(false);
    expect(await ensureGooglePermission()).toBe(false);
  });

  it('returns false when the request throws', async () => {
    mockChrome.permissions.request.mockRejectedValueOnce(new Error('x'));
    expect(await ensureGooglePermission()).toBe(false);
  });
});

describe('ensureOriginPermission', () => {
  it('requests the site origin pattern and returns true when granted', async () => {
    mockChrome.permissions.request.mockResolvedValueOnce(true);
    expect(await ensureOriginPermission('https://github.com/foo')).toBe(true);
    expect(mockChrome.permissions.request).toHaveBeenCalledWith({ origins: ['https://github.com/*'] });
  });
  it('returns false for an invalid URL', async () => {
    expect(await ensureOriginPermission('not a url')).toBe(false);
  });
  it('returns false when denied', async () => {
    mockChrome.permissions.request.mockResolvedValueOnce(false);
    expect(await ensureOriginPermission('https://x.com')).toBe(false);
  });
});

describe('hasOriginPermission', () => {
  it('checks contains with the origin pattern and returns true', async () => {
    mockChrome.permissions.contains.mockResolvedValueOnce(true);
    expect(await hasOriginPermission('https://github.com/x')).toBe(true);
    expect(mockChrome.permissions.contains).toHaveBeenCalledWith({ origins: ['https://github.com/*'] });
  });
  it('returns false when not contained', async () => {
    mockChrome.permissions.contains.mockResolvedValueOnce(false);
    expect(await hasOriginPermission('https://x.com')).toBe(false);
  });
  it('returns false for an invalid URL', async () => {
    expect(await hasOriginPermission('nope')).toBe(false);
  });
});
