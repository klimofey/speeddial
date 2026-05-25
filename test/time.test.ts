import { describe, it, expect } from 'vitest';
import { formatTime, listTimeZones, labelForZone } from '../src/lib/time';

describe('formatTime', () => {
  const noonUtc = new Date('2026-05-24T12:00:00Z');

  it('formats 24h without AM/PM', () => {
    expect(formatTime(noonUtc, { timeZone: 'UTC', hour12: false })).toBe('12:00');
  });
  it('formats 12h with AM/PM', () => {
    expect(formatTime(noonUtc, { timeZone: 'UTC', hour12: true })).toBe('12:00 PM');
  });
  it('respects the time zone (New York is UTC-4 in May)', () => {
    expect(formatTime(noonUtc, { timeZone: 'America/New_York', hour12: false })).toBe('08:00');
  });
});

describe('labelForZone', () => {
  it('uses the city segment and replaces underscores', () => {
    expect(labelForZone('America/New_York')).toBe('New York');
  });
  it('returns the input when there is no slash', () => {
    expect(labelForZone('UTC')).toBe('UTC');
  });
});

describe('listTimeZones', () => {
  it('returns a non-empty list including a known zone', () => {
    const zones = listTimeZones();
    expect(zones.length).toBeGreaterThan(0);
    expect(zones).toContain('UTC');
  });
});
