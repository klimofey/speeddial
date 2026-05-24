const PALETTE = [
  '#4285f4', '#ea4335', '#34a853', '#fbbc05', '#7c4dff',
  '#e91e63', '#00bcd4', '#ff7043', '#26a69a', '#5c6bc0',
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function colorForKey(key: string): string {
  return PALETTE[hash(key) % PALETTE.length];
}

export function initialFor(title: string, url: string): string {
  const t = title.trim();
  if (t) return t[0].toUpperCase();
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host) return host[0].toUpperCase();
  } catch { /* not a valid URL */ }
  return '?';
}
