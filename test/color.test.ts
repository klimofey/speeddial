import { describe, it, expect } from 'vitest';
import { colorForKey, initialFor } from '../src/lib/color';

describe('color helper', () => {
  it('returns a stable hex color for the same input', () => {
    expect(colorForKey('https://github.com')).toBe(colorForKey('https://github.com'));
  });
  it('returns a 7-char hex string', () => {
    expect(colorForKey('x')).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('derives an uppercase initial from a title', () => {
    expect(initialFor('github', 'https://github.com')).toBe('G');
  });
  it('falls back to the url hostname when title is empty', () => {
    expect(initialFor('', 'https://duckduckgo.com')).toBe('D');
  });
  it('returns "?" when nothing usable is present', () => {
    expect(initialFor('', '')).toBe('?');
  });
});
