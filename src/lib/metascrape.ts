function attrsAll(doc: Document, selector: string, name: string): string[] {
  return Array.from(doc.querySelectorAll(selector))
    .map((el) => el.getAttribute(name))
    .filter((v): v is string => !!v && v.trim().length > 0)
    .map((v) => v.trim());
}

// Pulls url(...) targets out of inline `style` attributes that set a background
// (e.g. a logo declared as `<a style="background-image: url(/logo.png)">`), which
// the meta/icon/img selectors miss.
function backgroundUrls(doc: Document): string[] {
  const re = /url\(\s*['"]?([^'")]+?)['"]?\s*\)/gi;
  const out: string[] = [];
  for (const el of Array.from(doc.querySelectorAll('[style]'))) {
    const style = el.getAttribute('style') || '';
    if (!/background/i.test(style)) continue;
    let m: RegExpExecArray | null;
    while ((m = re.exec(style))) {
      const u = m[1].trim();
      if (u) out.push(u);
    }
  }
  return out;
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
    ...backgroundUrls(doc),
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

// Domain-derived icon URLs from keyless services. No fetch and no host permission
// (these are rendered as <img src>). Each may 404; the gallery hides broken ones.
export function iconSources(pageUrl: string): string[] {
  let host: string;
  try {
    host = new URL(pageUrl).hostname;
  } catch {
    return [];
  }
  if (!host) return [];
  return [
    `https://www.google.com/s2/favicons?domain=${host}&sz=256`,
    `https://icons.duckduckgo.com/ip3/${host}.ico`,
    `https://icon.horse/icon/${host}`,
  ];
}
