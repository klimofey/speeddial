# Image Picker + Card Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let "Find better image" collect many page images (incl. SVG) and let the user pick from a gallery, with a live preview of the current card image in the editor.

**Architecture:** `scrapeImages` (replacing `scrapeBestImage`) returns a deduped candidate list; the card thumbnail rendering is extracted into a shared `CardThumb` used by both `DialCard` and the editor's live preview; `CardEditor` shows the preview plus a clickable candidate gallery.

**Tech Stack:** TypeScript, Preact, Vitest + @testing-library/preact, `DOMParser`.

---

## File Structure

```
src/lib/metascrape.ts         # MODIFY: scrapeBestImage → scrapeImages (string[])
src/components/CardThumb.tsx   # NEW: shared preview (resolvePreview + onError cascade)
src/components/DialCard.tsx    # MODIFY: use CardThumb for the thumb
src/components/CardEditor.tsx  # MODIFY: live preview + candidate gallery; uses scrapeImages
src/styles/global.css          # MODIFY: .ce-preview, .ce-candidates, .ce-candidate
```

---

## Task 1: `scrapeImages` (collect candidates)

**Files:**
- Modify: `src/lib/metascrape.ts`, `test/metascrape.test.ts`

- [ ] **Step 1: Replace the test body in `test/metascrape.test.ts`**

Replace the entire `describe('scrapeBestImage', ...)` block (and update the import from `scrapeBestImage` to `scrapeImages`) with:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { scrapeImages } from '../src/lib/metascrape';

afterEach(() => vi.unstubAllGlobals());
function stubHtml(html: string, ok = true) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, text: async () => html })));
}

describe('scrapeImages', () => {
  it('collects og/twitter/apple/icon/mask-icon and <img>, resolved + deduped, SVG kept', async () => {
    stubHtml(`<html><head>
      <meta property="og:image" content="/hero.png">
      <meta name="twitter:image" content="https://cdn.test/t.jpg">
      <link rel="apple-touch-icon" href="/touch.png">
      <link rel="icon" type="image/svg+xml" href="/favicon.svg">
      <link rel="mask-icon" href="/mask.svg">
    </head><body><img src="/a.png"><img src="/a.png"><img src="https://x.test/b.jpg"></body></html>`);
    const r = await scrapeImages('https://site.com/page');
    expect(r).toContain('https://site.com/hero.png');
    expect(r).toContain('https://cdn.test/t.jpg');
    expect(r).toContain('https://site.com/touch.png');
    expect(r).toContain('https://site.com/favicon.svg');
    expect(r).toContain('https://site.com/mask.svg');
    expect(r).toContain('https://site.com/a.png');
    expect(r).toContain('https://x.test/b.jpg');
    expect(r.filter((u) => u.endsWith('/a.png'))).toHaveLength(1); // deduped
    expect(r[0]).toBe('https://site.com/hero.png'); // og:image first
  });

  it('caps at 12', async () => {
    const imgs = Array.from({ length: 20 }, (_, i) => `<img src="/i${i}.png">`).join('');
    stubHtml(`<html><body>${imgs}</body></html>`);
    expect((await scrapeImages('https://s.com')).length).toBe(12);
  });

  it('returns [] when nothing matches', async () => {
    stubHtml('<html><head></head><body></body></html>');
    expect(await scrapeImages('https://s.com')).toEqual([]);
  });

  it('returns [] on a non-ok response', async () => {
    stubHtml('x', false);
    expect(await scrapeImages('https://s.com')).toEqual([]);
  });

  it('returns [] on fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('net'); }));
    expect(await scrapeImages('https://s.com')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/metascrape.test.ts`
Expected: FAIL — `scrapeImages` not exported.

- [ ] **Step 3: Replace the contents of `src/lib/metascrape.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/metascrape.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/metascrape.ts test/metascrape.test.ts
git commit -m "feat: scrapeImages collects many page image candidates"
```

> NOTE: `CardEditor` still imports the removed `scrapeBestImage`, so `tsc`/build are red until Task 3. `npm test` for this file passes now. (Run targeted vitest only this task.)

---

## Task 2: Extract `CardThumb`

**Files:**
- Create: `src/components/CardThumb.tsx`, `test/cardthumb.test.tsx`
- Modify: `src/components/DialCard.tsx`

- [ ] **Step 1: Write `test/cardthumb.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { CardThumb } from '../src/components/CardThumb';
import { Dial } from '../src/lib/types';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';

const dial: Dial = { id: 'a', url: 'https://github.com', title: 'GitHub', imageRef: 'letter', color: '#123456', order: 0 };

describe('CardThumb', () => {
  it('renders a letter for letter mode', async () => {
    render(<CardThumb dial={dial} settings={DEFAULT_SETTINGS} />);
    await waitFor(() => expect(screen.getByText('G')).toBeTruthy());
  });

  it('renders an image for a favicon dial and cascades apple-touch -> favicon -> letter on error', async () => {
    const { container } = render(
      <CardThumb dial={{ ...dial, imageRef: 'favicon' }} settings={DEFAULT_SETTINGS} />,
    );
    await waitFor(() => expect(container.querySelector('img')).toBeTruthy());
    fireEvent.error(container.querySelector('img')!);
    await waitFor(() => expect(container.querySelector('img')).toBeTruthy());
    fireEvent.error(container.querySelector('img')!);
    await waitFor(() => expect(screen.getByText('G')).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/cardthumb.test.tsx`
Expected: FAIL — cannot resolve `../src/components/CardThumb`.

- [ ] **Step 3: Create `src/components/CardThumb.tsx`**

```tsx
import { useEffect, useState } from 'preact/hooks';
import { Dial, Settings } from '../lib/types';
import { Preview, resolvePreview, letterFallback } from '../lib/images';

export function CardThumb({ dial, settings }: { dial: Dial; settings: Settings }) {
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    let alive = true;
    void resolvePreview(dial, settings).then((p) => { if (alive) setPreview(p); });
    return () => { alive = false; };
  }, [dial, settings]);

  const onImgError = () => {
    if (preview?.kind === 'favicon' && preview.next) setPreview({ kind: 'favicon', src: preview.next });
    else setPreview(letterFallback(dial));
  };

  return (
    <div class="dial-thumb">
      {preview?.kind === 'image' && <img src={preview.src} alt="" onError={onImgError} />}
      {preview?.kind === 'favicon' && <img class="dial-favicon" src={preview.src} alt="" onError={onImgError} />}
      {preview?.kind === 'letter' && (
        <span class="dial-letter" style={{ background: preview.color }}>{preview.letter}</span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/cardthumb.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Replace the contents of `src/components/DialCard.tsx`**

```tsx
import { Dial, Settings } from '../lib/types';
import { spanFromDelta } from '../lib/layout';
import { CardThumb } from './CardThumb';

interface Props {
  dial: Dial;
  settings: Settings;
  onEdit: (dial: Dial) => void;
  onDelete: (id: string) => void;
  editing?: boolean;
  onResize?: (id: string, size: { w: number; h: number }) => void;
}

export function DialCard({ dial, settings, onEdit, onDelete, editing = false, onResize }: Props) {
  const size = dial.size ?? { w: 1, h: 1 };

  const startResize = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
    const move = (ev: MouseEvent) => {
      onResize?.(dial.id, {
        w: spanFromDelta(start.w, ev.clientX - start.x),
        h: spanFromDelta(start.h, ev.clientY - start.y),
      });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div
      class={`dial-card${editing ? ' editing' : ''}`}
      data-id={dial.id}
      style={{ gridColumn: `span ${size.w}`, gridRow: `span ${size.h}` }}
    >
      <a class="dial-link" href={dial.url} onClick={(e) => { if (editing) e.preventDefault(); }}>
        <CardThumb dial={dial} settings={settings} />
        <span class="dial-title">{dial.title}</span>
      </a>
      <div class="dial-actions">
        <button aria-label={`Edit ${dial.title}`} onClick={() => onEdit(dial)}>✎</button>
        <button aria-label={`Delete ${dial.title}`} onClick={() => onDelete(dial.id)}>✕</button>
      </div>
      {editing && (
        <span class="dial-resize" aria-label={`Resize ${dial.title}`} role="button" onMouseDown={startResize} />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run the DialCard + CardThumb tests**

Run: `npx vitest run test/dialcard.test.tsx test/cardthumb.test.tsx`
Expected: PASS — DialCard tests unchanged (CardThumb renders the same `.dial-thumb` DOM; the cascade test still finds the imgs and the letter).

- [ ] **Step 7: Commit**

```bash
git add src/components/CardThumb.tsx test/cardthumb.test.tsx src/components/DialCard.tsx
git commit -m "refactor: extract CardThumb shared preview from DialCard"
```

---

## Task 3: CardEditor live preview + candidate gallery

**Files:**
- Modify: `src/components/CardEditor.tsx`, `test/cardeditor.test.tsx`, `src/styles/global.css`

- [ ] **Step 1: Update the scrape tests in `test/cardeditor.test.tsx`**

Change the metascrape mock to `scrapeImages`, and replace the three F3 scrape-flow tests (`grants access then finds a better image (two-step)`, `skips the prompt when permission is already granted`, `shows guidance when access is denied`) with the four below. Mocks at top:
```tsx
vi.mock('../src/lib/permissions', () => ({
  hasOriginPermission: vi.fn(async () => false),
  ensureOriginPermission: vi.fn(async () => true),
}));
vi.mock('../src/lib/metascrape', () => ({
  scrapeImages: vi.fn(async () => ['https://cdn.example/a.png', 'https://cdn.example/b.png']),
}));
```
Tests (inside `describe('CardEditor', ...)`):
```tsx
  it('after Allow access, shows a candidate gallery; picking one sets a meta- image', async () => {
    const onSave = vi.fn();
    const { container } = render(<CardEditor settings={DEFAULT_SETTINGS} onSave={onSave} onClose={() => {}} />);
    fireEvent.input(screen.getByLabelText('URL'), { target: { value: 'https://github.com' } });
    fireEvent.click(screen.getByText('Find better image'));
    await waitFor(() => screen.getByText('Allow access'));
    fireEvent.click(screen.getByText('Allow access'));
    await waitFor(() => expect(screen.getByText(/Found 2 images/)).toBeTruthy());
    const thumbs = container.querySelectorAll('.ce-candidate');
    expect(thumbs.length).toBe(2);
    fireEvent.click(thumbs[0]);
    await waitFor(() => expect(screen.getByText(/Selected/)).toBeTruthy());
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ imageRef: expect.stringMatching(/^meta-/) }));
  });

  it('shows the gallery directly when permission is already granted', async () => {
    const perms = await import('../src/lib/permissions');
    (perms.hasOriginPermission as unknown as { mockResolvedValueOnce: (v: boolean) => void }).mockResolvedValueOnce(true);
    render(<CardEditor settings={DEFAULT_SETTINGS} onSave={() => {}} onClose={() => {}} />);
    fireEvent.input(screen.getByLabelText('URL'), { target: { value: 'https://github.com' } });
    fireEvent.click(screen.getByText('Find better image'));
    await waitFor(() => expect(screen.getByText(/Found 2 images/)).toBeTruthy());
    expect(screen.queryByText('Allow access')).toBeNull();
  });

  it('shows guidance when access is denied', async () => {
    const perms = await import('../src/lib/permissions');
    (perms.ensureOriginPermission as unknown as { mockResolvedValueOnce: (v: boolean) => void }).mockResolvedValueOnce(false);
    render(<CardEditor settings={DEFAULT_SETTINGS} onSave={() => {}} onClose={() => {}} />);
    fireEvent.input(screen.getByLabelText('URL'), { target: { value: 'https://github.com' } });
    fireEvent.click(screen.getByText('Find better image'));
    await waitFor(() => screen.getByText('Allow access'));
    fireEvent.click(screen.getByText('Allow access'));
    await waitFor(() => expect(screen.getByText(/Access denied/)).toBeTruthy());
  });

  it('reports when no images are found', async () => {
    const meta = await import('../src/lib/metascrape');
    (meta.scrapeImages as unknown as { mockResolvedValueOnce: (v: string[]) => void }).mockResolvedValueOnce([]);
    const perms = await import('../src/lib/permissions');
    (perms.hasOriginPermission as unknown as { mockResolvedValueOnce: (v: boolean) => void }).mockResolvedValueOnce(true);
    render(<CardEditor settings={DEFAULT_SETTINGS} onSave={() => {}} onClose={() => {}} />);
    fireEvent.input(screen.getByLabelText('URL'), { target: { value: 'https://github.com' } });
    fireEvent.click(screen.getByText('Find better image'));
    await waitFor(() => expect(screen.getByText(/No images found/)).toBeTruthy());
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/cardeditor.test.tsx`
Expected: FAIL — `scrapeImages` not used / no `.ce-candidate` gallery.

- [ ] **Step 3: Edit `src/components/CardEditor.tsx`**

Update imports:
- change `import { scrapeBestImage } from '../lib/metascrape';` to `import { scrapeImages } from '../lib/metascrape';`
- add `import { CardThumb } from './CardThumb';`
- ensure `colorForKey` is imported from `'../lib/color'` (it already is — used in `save`).

Add candidate state next to `scrapeStep`:
```tsx
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selectedUrl, setSelectedUrl] = useState('');
```
Replace the `doScrape` function with:
```tsx
  const doScrape = async () => {
    setScrapeStep('searching');
    setScrapeMsg('Searching…');
    setBusy(true);
    const imgs = await scrapeImages(normalizeUrl(url));
    setBusy(false);
    setScrapeStep('idle');
    if (!imgs.length) { setCandidates([]); setScrapeMsg('No images found on the page.'); return; }
    setCandidates(imgs);
    setScrapeMsg(`Found ${imgs.length} images — pick one`);
  };

  const selectCandidate = async (imgUrl: string) => {
    const ref = 'meta-' + Date.now().toString(36);
    await setImage(ref, { data: imgUrl, source: 'url', srcUrl: imgUrl });
    setUploadRef(ref);
    setMode('upload');
    setSelectedUrl(imgUrl);
    setScrapeMsg('Selected ✓');
  };
```
Add a `previewDial` just before the `return (`:
```tsx
  const previewImageRef =
    mode === 'upload' && uploadRef ? uploadRef
    : mode === 'url' ? 'favicon'
    : mode;
  const previewUrl = normalizeUrl(url) || 'https://example.com';
  const previewDial: Dial = {
    id: 'preview', url: previewUrl, title: title || 'preview',
    imageRef: previewImageRef, color: initial?.color || colorForKey(previewUrl), order: 0,
  };
```
In the JSX, add the live preview as the FIRST child inside the `.modal` (right after the `<h3>` heading):
```tsx
        <div class="ce-preview">
          {mode === 'url' && imageUrl.trim()
            ? <img src={imageUrl} alt="" />
            : <CardThumb dial={previewDial} settings={settings} />}
        </div>
```
Replace the existing "Find better image" / "Allow access" block's trailing area: keep the `{url.trim() && (<div class="ce-find-row">...)}` and `{scrapeMsg && ...}` as-is, and immediately AFTER the `{scrapeMsg && ...}` line add the gallery:
```tsx
        {candidates.length > 0 && (
          <div class="ce-candidates">
            {candidates.map((c) => (
              <button
                type="button"
                key={c}
                class={`ce-candidate${c === selectedUrl ? ' selected' : ''}`}
                onClick={() => selectCandidate(c)}
              >
                <img src={c} alt="" onError={(e) => {
                  const btn = (e.currentTarget as HTMLElement).parentElement as HTMLElement | null;
                  if (btn) btn.style.display = 'none';
                }} />
              </button>
            ))}
          </div>
        )}
```
(`Dial` is already imported in CardEditor; if not, add it to the `'../lib/types'` import.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/cardeditor.test.tsx`
Expected: PASS (non-scrape tests + 4 new).

- [ ] **Step 5: Append styles to `src/styles/global.css`**

```css
.ce-preview { align-self: center; width: 96px; height: 96px; margin-bottom: 6px; }
.ce-preview .dial-thumb { width: 100%; height: 100%; }
.ce-preview > img { width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius); }
.ce-candidates { display: grid; grid-template-columns: repeat(auto-fill, 56px); gap: 8px;
  max-height: 180px; overflow-y: auto; padding: 4px 0; }
.ce-candidate { width: 56px; height: 56px; padding: 0; border: 2px solid transparent; border-radius: 8px;
  background: var(--search-bg, #fff); cursor: pointer; overflow: hidden; }
.ce-candidate.selected { border-color: var(--accent, #4285f4); }
.ce-candidate img { width: 100%; height: 100%; object-fit: contain; }
```

- [ ] **Step 6: Full suite, type-check, build, push**

Run: `npm test` → all pass (report count). Run: `npx tsc --noEmit` → 0 errors.
Run: `npm run build` → clean `dist/`; `find src test -name '*.js'` returns nothing.
```bash
git add src/components/CardEditor.tsx test/cardeditor.test.tsx src/styles/global.css
git commit -m "feat: candidate image gallery and live preview in CardEditor"
git push origin feat/speeddial-mvp
```

---

## Self-Review Notes

- **Spec coverage:** `scrapeImages` with og/twitter/apple/icon/mask-icon/`<img>`, SVG kept, dedupe, cap, fail-soft (Task 1); shared `CardThumb` used by DialCard + editor (Task 2); CardEditor live preview + gallery picker + "no images" message, permission flow preserved (Task 3). All spec sections map to a task.
- **Type consistency:** `scrapeImages(pageUrl): Promise<string[]>` consistent metascrape ↔ CardEditor; `CardThumb({dial, settings})` consistent across DialCard + CardEditor; `previewDial: Dial` matches the `Dial` type; `StoredImage { data, source:'url', srcUrl }` unchanged.
- **Placeholder scan:** none.
- **Regression guards flagged:** (a) Task 1 leaves `tsc`/build red until Task 3 swaps `scrapeBestImage`→`scrapeImages` in CardEditor (optional `next`/per-task vitest stays green); (b) Task 3 deletes the three F3 single-pick scrape tests (that flow is replaced by the gallery).
- **DialCard tests unchanged:** CardThumb emits the same `.dial-thumb`/`.dial-favicon`/`.dial-letter` DOM, so DialCard's existing tests (incl. the favicon cascade) keep passing without edits.
```
