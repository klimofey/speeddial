import { describe, it, expect } from 'vitest';
import { mockChrome } from './setup';
import { ensureGooglePermission, GOOGLE_SUGGEST_ORIGIN } from '../src/lib/permissions';

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
