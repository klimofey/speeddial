// Renders a page in a background tab so its JS runs, then reads the live DOM for
// image/logo candidates the static `scrapeImages` can't see (e.g. React/SPA logos
// injected as inline <svg> after load). Needs the `scripting` permission + host
// permission for the URL. Any failure resolves to [] — it never throws.

const HYDRATION_MS = 1200; // extra wait after 'complete' for SPA JS to paint the logo
const LOAD_TIMEOUT_MS = 8000; // hard cap if the page never reports complete

// Runs IN the page (serialized by chrome.scripting). Must be self-contained — no
// references to module scope. Returns absolute image URLs / data URIs.
// Exported only so it can be unit-tested directly against a jsdom document.
export function extractInPage(): string[] {
  const out: string[] = [];
  const push = (u: string | null | undefined) => {
    if (!u) return;
    try { out.push(new URL(u, location.href).href); } catch { /* skip unparseable */ }
  };

  document
    .querySelectorAll('meta[property="og:image"], meta[name="og:image"], meta[name="twitter:image"], meta[property="twitter:image"]')
    .forEach((m) => push(m.getAttribute('content')));
  document
    .querySelectorAll('link[rel~="apple-touch-icon"], link[rel~="icon"], link[rel="mask-icon"]')
    .forEach((l) => push(l.getAttribute('href')));

  document.querySelectorAll('[style]').forEach((el) => {
    const style = el.getAttribute('style') || '';
    if (!/background/i.test(style)) return;
    for (const m of style.matchAll(/url\(\s*['"]?([^'")]+?)['"]?\s*\)/gi)) push(m[1]);
  });

  const serializer = new XMLSerializer();
  let svgCount = 0;
  document.querySelectorAll('svg').forEach((svg) => {
    if (svgCount >= 4) return;
    const w = parseFloat(svg.getAttribute('width') || '0');
    const h = parseFloat(svg.getAttribute('height') || '0');
    let big = w >= 32 || h >= 32;
    if (!big) {
      const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
      if (vb.length === 4 && (vb[2] >= 64 || vb[3] >= 64)) big = true;
    }
    if (!big) return;
    try {
      out.push('data:image/svg+xml;utf8,' + encodeURIComponent(serializer.serializeToString(svg)));
      svgCount++;
    } catch { /* skip */ }
  });

  document.querySelectorAll('img[src]').forEach((img) => push(img.getAttribute('src')));

  const seen = new Set<string>();
  const res: string[] = [];
  for (const u of out) {
    if (seen.has(u)) continue;
    seen.add(u);
    res.push(u);
    if (res.length >= 14) break;
  }
  return res;
}

function waitForLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      // Give SPA JS a moment past 'complete' to render the logo before extracting.
      setTimeout(resolve, HYDRATION_MS);
    };
    const listener = (id: number, info: { status?: string }) => {
      if (id === tabId && info.status === 'complete') finish();
    };
    const timer = setTimeout(finish, LOAD_TIMEOUT_MS);
    chrome.tabs.onUpdated.addListener(listener);
  });
}

export async function scrapeRendered(pageUrl: string): Promise<string[]> {
  if (typeof chrome === 'undefined' || !chrome.scripting?.executeScript || !chrome.tabs?.create) return [];
  let tabId: number | undefined;
  try {
    const tab = await chrome.tabs.create({ url: pageUrl, active: false });
    tabId = tab.id;
    if (tabId == null) return [];
    await waitForLoad(tabId);
    const results = await chrome.scripting.executeScript({ target: { tabId }, func: extractInPage });
    const result = results?.[0]?.result;
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  } finally {
    if (tabId != null) {
      try { await chrome.tabs.remove(tabId); } catch { /* best-effort */ }
    }
  }
}
