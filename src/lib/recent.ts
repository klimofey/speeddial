export interface RecentSite {
  url: string;
  title: string;
  origin: string;
  score: number;
}

const WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // last 14 days

interface Ranked extends RecentSite {
  lastVisit: number;
}

export async function getRecentSites(opts: { excludeUrls: string[]; limit?: number }): Promise<RecentSite[]> {
  if (typeof chrome === 'undefined' || !chrome.history?.search) return [];

  let items: Array<{ url?: string; title?: string; lastVisitTime?: number; visitCount?: number }>;
  try {
    items = await chrome.history.search({ text: '', startTime: Date.now() - WINDOW_MS, maxResults: 200 });
  } catch {
    return [];
  }

  const selfUrl = chrome.runtime?.getURL ? chrome.runtime.getURL('index.html') : '';
  const excludeOrigins = new Set<string>();
  for (const u of opts.excludeUrls) {
    try { excludeOrigins.add(new URL(u).origin); } catch { /* ignore unparseable */ }
  }

  const byOrigin = new Map<string, Ranked>();
  for (const it of items) {
    if (!it.url || it.url === selfUrl) continue;
    let origin: string;
    try { origin = new URL(it.url).origin; } catch { continue; }
    if (origin === 'null' || !origin.startsWith('http')) continue;
    if (excludeOrigins.has(origin)) continue;

    const visit = it.lastVisitTime ?? 0;
    const count = it.visitCount ?? 1;
    const existing = byOrigin.get(origin);
    if (!existing) {
      byOrigin.set(origin, { url: it.url, title: it.title || origin, origin, score: count, lastVisit: visit });
    } else {
      existing.score += count;
      if (visit > existing.lastVisit) {
        existing.lastVisit = visit;
        existing.url = it.url;
        existing.title = it.title || existing.title;
      }
    }
  }

  return [...byOrigin.values()]
    .sort((a, b) => b.score - a.score || b.lastVisit - a.lastVisit)
    .slice(0, opts.limit ?? 8)
    .map(({ url, title, origin, score }) => ({ url, title, origin, score }));
}
