function attr(doc: Document, selector: string, name: string): string | null {
  const v = doc.querySelector(selector)?.getAttribute(name);
  return v && v.trim() ? v.trim() : null;
}

// Fetches a page and returns the best hero/icon image URL, or null.
export async function scrapeBestImage(pageUrl: string): Promise<string | null> {
  let html: string;
  try {
    const res = await fetch(pageUrl);
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return null;
  }
  const candidate =
    attr(doc, 'meta[property="og:image"]', 'content') ??
    attr(doc, 'meta[name="twitter:image"]', 'content') ??
    attr(doc, 'link[rel="apple-touch-icon"]', 'href') ??
    attr(doc, 'link[rel="icon"]', 'href');
  if (!candidate) return null;
  try {
    return new URL(candidate, pageUrl).href;
  } catch {
    return null;
  }
}
