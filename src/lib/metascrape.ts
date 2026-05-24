function attrsAll(doc: Document, selector: string, name: string): string[] {
  return Array.from(doc.querySelectorAll(selector))
    .map((el) => el.getAttribute(name))
    .filter((v): v is string => !!v && v.trim().length > 0)
    .map((v) => v.trim());
}

// Fetches a page and returns candidate image URLs (meta/icons first, then page
// <img>), resolved to absolute, de-duped, capped. SVGs are kept (no extension filter).
export async function scrapeImages(pageUrl: string): Promise<string[]> {
  let html: string;
  try {
    const res = await fetch(pageUrl);
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return [];
  }
  const raw = [
    ...attrsAll(doc, 'meta[property="og:image"], meta[name="og:image"]', 'content'),
    ...attrsAll(doc, 'meta[name="twitter:image"], meta[property="twitter:image"]', 'content'),
    ...attrsAll(doc, 'link[rel~="apple-touch-icon"]', 'href'),
    ...attrsAll(doc, 'link[rel~="icon"]', 'href'),
    ...attrsAll(doc, 'link[rel="mask-icon"]', 'href'),
    ...attrsAll(doc, 'img[src]', 'src'),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of raw) {
    let abs: string;
    try {
      abs = new URL(c, pageUrl).href;
    } catch {
      continue;
    }
    if (seen.has(abs)) continue;
    seen.add(abs);
    out.push(abs);
    if (out.length >= 12) break;
  }
  return out;
}
