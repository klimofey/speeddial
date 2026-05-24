export function formatTime(date: Date, opts: { timeZone?: string; hour12: boolean }): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: opts.hour12,
    timeZone: opts.timeZone,
  });
}

export function listTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  if (typeof intl.supportedValuesOf === 'function') {
    try {
      const zones = intl.supportedValuesOf('timeZone');
      // Ensure 'UTC' is always present; some ICU builds omit it from the canonical list.
      return zones.includes('UTC') ? zones : ['UTC', ...zones];
    } catch {
      /* fall through to the minimal fallback */
    }
  }
  return ['UTC'];
}

export function labelForZone(tz: string): string {
  const seg = tz.includes('/') ? tz.slice(tz.lastIndexOf('/') + 1) : tz;
  return seg.replace(/_/g, ' ');
}
