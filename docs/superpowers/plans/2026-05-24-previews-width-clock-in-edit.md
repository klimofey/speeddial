# Previews, Width & Clock-in-Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use wide screens (adaptive grid width), render crisper icons (apple-touch-icon + larger favicon, with an opt-in meta-scrape), and move clock configuration out of Settings into edit mode.

**Architecture:** A CSS width change; an extended preview cascade in `images.ts`/`DialCard`; a new `metascrape.ts` + a runtime origin-permission helper feeding an opt-in CardEditor button; and a new `ClockSettings` component shown in edit mode (its controls removed from the Settings modal).

**Tech Stack:** TypeScript, Preact, Vite, Vitest + @testing-library/preact, `DOMParser`, `chrome.permissions`.

---

## File Structure

```
src/styles/global.css        # MODIFY: adaptive grid/recent width
src/lib/images.ts            # MODIFY: appleTouchIconUrl + favicon `next` fallback
src/components/DialCard.tsx  # MODIFY: onImgError steps apple-touch → favicon → letter
src/lib/metascrape.ts        # NEW: scrapeBestImage(pageUrl)
src/lib/permissions.ts       # MODIFY: ensureOriginPermission(pageUrl)
manifest.config.ts           # MODIFY: wildcard optional_host_permissions
src/components/CardEditor.tsx# MODIFY: "Find better image" button
src/components/ClockSettings.tsx # NEW: clock controls (show/format/greeting/world clocks)
src/components/Settings.tsx  # MODIFY: remove clock controls (now in ClockSettings)
src/components/NewTab.tsx    # MODIFY: edit-mode "Clock" trigger + modal
```

---

## Task 1: Adaptive grid width (CSS)

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Widen the grid and recent row**

In `src/styles/global.css`, change the `max-width: 920px` in the `.dial-grid` rule and in the `.recent-row` rule to `min(1600px, 94vw)`. Concretely:
- `.dial-grid { ... max-width: min(1600px, 94vw); ... }` (was `max-width: 920px`).
- `.recent-row { max-width: min(1600px, 94vw); margin: 0 auto; padding: 4px 24px 0; }` (was `max-width: 920px`).
Leave every other property and rule unchanged.

- [ ] **Step 2: Verify nothing broke**

Run: `npm test` → all pass (no test asserts the 920px value).
Run: `npm run build` → clean `dist/`.

- [ ] **Step 3: Commit**

```bash
git add src/styles/global.css
git commit -m "feat: adaptive dashboard width to use wide screens"
```

---

## Task 2: Crisper icons (apple-touch-icon + favicon@128)

**Files:**
- Modify: `src/lib/images.ts`, `test/images.test.ts`, `src/components/DialCard.tsx`, `test/dialcard.test.tsx`

- [ ] **Step 1: Add tests to `test/images.test.ts`**

Add `appleTouchIconUrl` to the import from `../src/lib/images`. Add these tests inside `describe('images', ...)`:
```ts
  it('builds an apple-touch-icon URL at the site origin', () => {
    expect(appleTouchIconUrl('https://github.com/foo/bar')).toBe('https://github.com/apple-touch-icon.png');
  });

  it('favicon preview prefers apple-touch-icon with a favicon@128 fallback', async () => {
    const r = await resolvePreview(dial({ imageRef: 'favicon', url: 'https://github.com' }), settings);
    expect(r).toMatchObject({ kind: 'favicon', src: 'https://github.com/apple-touch-icon.png' });
    expect((r as { next?: string }).next).toContain('size=128');
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/images.test.ts`
Expected: FAIL — `appleTouchIconUrl` not exported; favicon preview has no `next`.

- [ ] **Step 3: Edit `src/lib/images.ts`**

Change the `Preview` favicon variant to include an optional `next`:
```ts
export type Preview =
  | { kind: 'image'; src: string }
  | { kind: 'favicon'; src: string; next?: string }
  | { kind: 'letter'; letter: string; color: string };
```
Add after `faviconUrl`:
```ts
export function appleTouchIconUrl(pageUrl: string): string {
  try {
    return new URL('/apple-touch-icon.png', pageUrl).href;
  } catch {
    return '';
  }
}

// Crisp-first favicon preview: apple-touch-icon, falling back to a 128px favicon.
function faviconPreview(pageUrl: string): Preview {
  const fav = faviconUrl(pageUrl, 128);
  return { kind: 'favicon', src: appleTouchIconUrl(pageUrl) || fav, next: fav };
}
```
In `resolvePreview`, replace BOTH `return { kind: 'favicon', src: faviconUrl(dial.url) };` lines (the screenshot-disabled branch and the final fallback) with:
```ts
    return faviconPreview(dial.url);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/images.test.ts`
Expected: PASS (existing + 2 new).

- [ ] **Step 5: Add tests to `test/dialcard.test.tsx`**

Add inside `describe('DialCard', ...)`:
```tsx
  it('falls back apple-touch-icon -> favicon -> letter on image errors', async () => {
    const { container } = render(
      <DialCard dial={{ ...dial, imageRef: 'favicon', title: 'GitHub', url: 'https://github.com' }}
        settings={DEFAULT_SETTINGS} onEdit={() => {}} onDelete={() => {}} />,
    );
    await waitFor(() => expect(container.querySelector('img')).toBeTruthy());
    fireEvent.error(container.querySelector('img')!);                 // apple-touch fails -> favicon
    await waitFor(() => expect(container.querySelector('img')).toBeTruthy());
    fireEvent.error(container.querySelector('img')!);                 // favicon fails -> letter
    await waitFor(() => expect(screen.getByText('G')).toBeTruthy());
  });
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run test/dialcard.test.tsx`
Expected: FAIL — current `onImgError` jumps straight to the letter, so the second `img` is absent.

- [ ] **Step 7: Update `onImgError` in `src/components/DialCard.tsx`**

Replace the existing `onImgError` definition with:
```tsx
  const onImgError = () => {
    if (preview?.kind === 'favicon' && preview.next) setPreview({ kind: 'favicon', src: preview.next });
    else setPreview(letterFallback(dial));
  };
```

- [ ] **Step 8: Run to verify it passes**

Run: `npx vitest run test/dialcard.test.tsx`
Expected: PASS.

- [ ] **Step 9: Full suite + commit**

Run: `npm test` → all pass. Run: `npx tsc --noEmit` → 0 errors.
```bash
git add src/lib/images.ts test/images.test.ts src/components/DialCard.tsx test/dialcard.test.tsx
git commit -m "feat: crisper icons via apple-touch-icon with favicon fallback"
```

---

## Task 3: `metascrape.ts` + origin permission + manifest

**Files:**
- Create: `src/lib/metascrape.ts`, `test/metascrape.test.ts`
- Modify: `src/lib/permissions.ts`, `test/permissions.test.ts`, `manifest.config.ts`

- [ ] **Step 1: Write `test/metascrape.test.ts`**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { scrapeBestImage } from '../src/lib/metascrape';

afterEach(() => vi.unstubAllGlobals());
function stubHtml(html: string, ok = true) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, text: async () => html })));
}

describe('scrapeBestImage', () => {
  it('prefers og:image and resolves a relative URL against the page', async () => {
    stubHtml('<html><head><meta property="og:image" content="/img/hero.png"><link rel="icon" href="/f.ico"></head></html>');
    expect(await scrapeBestImage('https://site.com/page')).toBe('https://site.com/img/hero.png');
  });
  it('falls back to apple-touch-icon when no og/twitter image', async () => {
    stubHtml('<html><head><link rel="apple-touch-icon" href="https://cdn.x/t.png"></head></html>');
    expect(await scrapeBestImage('https://site.com')).toBe('https://cdn.x/t.png');
  });
  it('returns null when nothing matches', async () => {
    stubHtml('<html><head></head></html>');
    expect(await scrapeBestImage('https://site.com')).toBeNull();
  });
  it('returns null on a non-ok response', async () => {
    stubHtml('x', false);
    expect(await scrapeBestImage('https://site.com')).toBeNull();
  });
  it('returns null on fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('net'); }));
    expect(await scrapeBestImage('https://site.com')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/metascrape.test.ts`
Expected: FAIL — cannot resolve `../src/lib/metascrape`.

- [ ] **Step 3: Create `src/lib/metascrape.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/metascrape.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Add `ensureOriginPermission` to `src/lib/permissions.ts`**

Append:
```ts
export async function ensureOriginPermission(pageUrl: string): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.request) return false;
  let pattern: string;
  try {
    pattern = new URL(pageUrl).origin + '/*';
  } catch {
    return false;
  }
  try {
    return await chrome.permissions.request({ origins: [pattern] });
  } catch {
    return false;
  }
}
```

- [ ] **Step 6: Add tests to `test/permissions.test.ts`**

Add `ensureOriginPermission` to the import. Add a new `describe`:
```ts
describe('ensureOriginPermission', () => {
  it('requests the site origin pattern and returns true when granted', async () => {
    mockChrome.permissions.request.mockResolvedValueOnce(true);
    expect(await ensureOriginPermission('https://github.com/foo')).toBe(true);
    expect(mockChrome.permissions.request).toHaveBeenCalledWith({ origins: ['https://github.com/*'] });
  });
  it('returns false for an invalid URL', async () => {
    expect(await ensureOriginPermission('not a url')).toBe(false);
  });
  it('returns false when denied', async () => {
    mockChrome.permissions.request.mockResolvedValueOnce(false);
    expect(await ensureOriginPermission('https://x.com')).toBe(false);
  });
});
```

- [ ] **Step 7: Run to verify**

Run: `npx vitest run test/permissions.test.ts`
Expected: PASS (existing + 3 new).

- [ ] **Step 8: Widen `optional_host_permissions` in `manifest.config.ts`**

Change the `optional_host_permissions` line to:
```ts
  optional_host_permissions: ['https://suggestqueries.google.com/*', 'https://*/*', 'http://*/*'],
```

- [ ] **Step 9: Full suite + commit**

Run: `npm test` → all pass. Run: `npx tsc --noEmit` → 0 errors.
```bash
git add src/lib/metascrape.ts test/metascrape.test.ts src/lib/permissions.ts test/permissions.test.ts manifest.config.ts
git commit -m "feat: add meta-image scraping and runtime origin permission"
```

---

## Task 4: CardEditor "Find better image" button

**Files:**
- Modify: `src/components/CardEditor.tsx`, `test/cardeditor.test.tsx`

- [ ] **Step 1: Add a test to `test/cardeditor.test.tsx`**

At the top of the file (after the existing imports), add module mocks:
```tsx
vi.mock('../src/lib/permissions', () => ({ ensureOriginPermission: vi.fn(async () => true) }));
vi.mock('../src/lib/metascrape', () => ({ scrapeBestImage: vi.fn(async () => 'https://cdn.example/hero.png') }));
```
Add inside `describe('CardEditor', ...)`:
```tsx
  it('finds a better image and saves it as the card image', async () => {
    const onSave = vi.fn();
    render(<CardEditor settings={DEFAULT_SETTINGS} onSave={onSave} onClose={() => {}} />);
    fireEvent.input(screen.getByLabelText('URL'), { target: { value: 'https://github.com' } });
    fireEvent.click(screen.getByText('Find better image'));
    await waitFor(() => expect(screen.getByText(/Found a better image/)).toBeTruthy());
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ imageRef: expect.stringMatching(/^meta-/) }));
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/cardeditor.test.tsx`
Expected: FAIL — no "Find better image" button.

- [ ] **Step 3: Edit `src/components/CardEditor.tsx`**

Add imports near the other lib imports:
```tsx
import { ensureOriginPermission } from '../lib/permissions';
import { scrapeBestImage } from '../lib/metascrape';
```
Add state next to the existing `error` state:
```tsx
  const [scrapeMsg, setScrapeMsg] = useState('');
```
Add this handler next to the other handlers (e.g. after `onFile`):
```tsx
  const findBetterImage = async () => {
    const finalUrl = normalizeUrl(url);
    setBusy(true);
    setScrapeMsg('Searching…');
    const ok = await ensureOriginPermission(finalUrl);
    if (!ok) { setBusy(false); setScrapeMsg('Permission denied — keeping the current preview.'); return; }
    const img = await scrapeBestImage(finalUrl);
    if (!img) { setBusy(false); setScrapeMsg('No better image found.'); return; }
    const ref = 'meta-' + Date.now().toString(36);
    await setImage(ref, { data: img, source: 'url', srcUrl: img });
    setUploadRef(ref);
    setMode('upload');
    setScrapeMsg('Found a better image ✓');
    setBusy(false);
  };
```
In the JSX, immediately AFTER the Preview `<select id="ce-mode">...</select>` block, add:
```tsx
        {url.trim() && (
          <button type="button" class="ce-find" onClick={findBetterImage} disabled={busy}>Find better image</button>
        )}
        {scrapeMsg && <p class="settings-msg">{scrapeMsg}</p>}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/cardeditor.test.tsx`
Expected: PASS (existing + 1 new).

- [ ] **Step 5: Append a style to `src/styles/global.css`**

```css
.ce-find { align-self: flex-start; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--muted, #ccc);
  background: transparent; color: inherit; cursor: pointer; font-size: 12px; }
.ce-find:disabled { opacity: .5; cursor: not-allowed; }
```

- [ ] **Step 6: Full suite + commit**

Run: `npm test` → all pass. Run: `npx tsc --noEmit` → 0 errors.
```bash
git add src/components/CardEditor.tsx test/cardeditor.test.tsx src/styles/global.css
git commit -m "feat: add opt-in 'Find better image' meta scrape to CardEditor"
```

---

## Task 5: Move clock config into edit mode

**Files:**
- Create: `src/components/ClockSettings.tsx`, `test/clocksettings.test.tsx`
- Modify: `src/components/Settings.tsx`, `test/settings.test.tsx`, `src/components/NewTab.tsx`, `test/newtab.test.tsx`, `src/styles/global.css`

- [ ] **Step 1: Write `test/clocksettings.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { ClockSettings } from '../src/components/ClockSettings';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';

describe('ClockSettings', () => {
  it('toggles show clock', () => {
    const onChange = vi.fn();
    render(<ClockSettings settings={{ ...DEFAULT_SETTINGS, showClock: true }} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Show clock'));
    expect(onChange).toHaveBeenCalledWith({ showClock: false });
  });
  it('changes the clock format', () => {
    const onChange = vi.fn();
    render(<ClockSettings settings={DEFAULT_SETTINGS} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Clock format'), { target: { value: '12h' } });
    expect(onChange).toHaveBeenCalledWith({ clockFormat: '12h' });
  });
  it('adds a world clock', () => {
    const onChange = vi.fn();
    render(<ClockSettings settings={DEFAULT_SETTINGS} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('World clocks'), { target: { value: 'America/New_York' } });
    expect(onChange).toHaveBeenCalledWith({ worldClocks: [expect.objectContaining({ timeZone: 'America/New_York', label: 'New York' })] });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/clocksettings.test.tsx`
Expected: FAIL — cannot resolve `../src/components/ClockSettings`.

- [ ] **Step 3: Create `src/components/ClockSettings.tsx`**

```tsx
import { Settings as SettingsType, WorldClock } from '../lib/types';
import { listTimeZones, labelForZone } from '../lib/time';

interface Props {
  settings: SettingsType;
  onChange: (patch: Partial<SettingsType>) => void;
}

export function ClockSettings({ settings, onChange }: Props) {
  const addWorldClock = (tz: string) => {
    const wc: WorldClock = { id: 'wc-' + Date.now().toString(36), timeZone: tz, label: labelForZone(tz) };
    onChange({ worldClocks: [...settings.worldClocks, wc] });
  };
  const removeWorldClock = (id: string) => onChange({ worldClocks: settings.worldClocks.filter((c) => c.id !== id) });
  const setLabel = (id: string, label: string) =>
    onChange({ worldClocks: settings.worldClocks.map((c) => (c.id === id ? { ...c, label } : c)) });

  return (
    <div class="clock-settings">
      <label>
        <input type="checkbox" checked={settings.showClock}
          onChange={(e) => onChange({ showClock: (e.target as HTMLInputElement).checked })} /> Show clock
      </label>

      <label for="cs-fmt">Clock format</label>
      <select id="cs-fmt" value={settings.clockFormat}
        onChange={(e) => onChange({ clockFormat: (e.target as HTMLSelectElement).value as '24h' | '12h' })}>
        <option value="24h">24-hour</option>
        <option value="12h">12-hour</option>
      </select>

      <label for="cs-name">Greeting name</label>
      <input id="cs-name" value={settings.greetingName ?? ''}
        onInput={(e) => onChange({ greetingName: (e.target as HTMLInputElement).value || null })} />

      <label for="cs-tz">World clocks</label>
      {settings.worldClocks.length > 0 && (
        <div class="wc-list">
          {settings.worldClocks.map((c) => (
            <div class="wc-item" key={c.id}>
              <input aria-label={`Label for ${c.timeZone}`} value={c.label}
                onInput={(e) => setLabel(c.id, (e.target as HTMLInputElement).value)} />
              <span class="wc-tz">{c.timeZone}</span>
              <button aria-label={`Remove ${c.label}`} onClick={() => removeWorldClock(c.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
      <select id="cs-tz" value="" onChange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v) addWorldClock(v); }}>
        <option value="">Add a time zone…</option>
        {listTimeZones().map((tz) => <option value={tz} key={tz}>{tz}</option>)}
      </select>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/clocksettings.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Remove the clock controls from `src/components/Settings.tsx`**

Delete from `Settings.tsx`:
- the "Show clock" `<label><input type="checkbox" checked={settings.showClock} ... /> Show clock</label>` block;
- the "Greeting name" `<label for="se-name">` + its `<input id="se-name" ... />`;
- the "Clock format" `<label for="se-clockfmt">` + its `<select id="se-clockfmt">...</select>`;
- the "World clocks" `<label for="se-addtz">` + the `{settings.worldClocks.length > 0 && (...)}` list + the `<select id="se-addtz">...</select>`;
- the `addWorldClock`, `removeWorldClock`, `setWorldClockLabel` handler functions.

Then remove now-unused imports to satisfy `noUnusedLocals`: drop `WorldClock` from the `'../lib/types'` import and remove the `import { listTimeZones, labelForZone } from '../lib/time';` line. Keep everything else (theme, background, search engine, card size, screenshots, show-recent, suggestions, backup).

- [ ] **Step 6: Update `test/settings.test.tsx`**

Delete the entire `describe('Settings clock options', ...)` block (the three tests for clock format / add / remove world clock — that behavior now lives in `ClockSettings`). Add one test asserting the clock controls are gone, inside the remaining describe (or as a new `describe('Settings without clock controls', ...)`):
```tsx
  it('no longer renders clock controls', () => {
    render(<Settings settings={DEFAULT_SETTINGS} onChange={() => {}} onClose={() => {}} onRestored={() => {}} />);
    expect(screen.queryByLabelText('Clock format')).toBeNull();
    expect(screen.queryByLabelText('World clocks')).toBeNull();
  });
```

- [ ] **Step 7: Wire the edit-mode Clock config in `src/components/NewTab.tsx`**

Add the import:
```tsx
import { ClockSettings } from './ClockSettings';
```
Add state after `editMode`:
```tsx
  const [showClockConfig, setShowClockConfig] = useState(false);
```
Add a "Clock" trigger button right AFTER the `edit-toggle` button, shown only in edit mode:
```tsx
      {editMode && <button class="edit-toggle clock-config-btn" onClick={() => setShowClockConfig(true)}>Clock</button>}
```
Add the modal at the end of the board (next to the `{showSettings && ...}` block):
```tsx
      {showClockConfig && (
        <div class="modal-backdrop" onClick={() => setShowClockConfig(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Clock</h3>
            <ClockSettings settings={settings} onChange={updateSettings} />
            <div class="modal-actions"><button onClick={() => setShowClockConfig(false)}>Close</button></div>
          </div>
        </div>
      )}
```

- [ ] **Step 8: Add a test to `test/newtab.test.tsx`**

```tsx
  it('opens clock config from edit mode', async () => {
    render(<NewTab />);
    await waitFor(() => screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Clock'));
    expect(screen.getByLabelText('Show clock')).toBeTruthy();
  });
```

- [ ] **Step 9: Append styles to `src/styles/global.css`**

```css
.clock-config-btn { right: 118px; }
.clock-settings { display: flex; flex-direction: column; gap: 6px; }
.clock-settings label { font-size: 12px; opacity: .8; }
.clock-settings select, .clock-settings input { padding: 8px 10px; border-radius: 8px;
  border: 1px solid var(--muted, #ccc); background: var(--search-bg, #fff); color: inherit; }
```

- [ ] **Step 10: Full suite, type-check, build, push**

Run: `npm test` → all pass (report count). Run: `npx tsc --noEmit` → 0 errors.
Run: `npm run build` → clean `dist/`; confirm `find src test -name '*.js'` returns nothing.
```bash
git add src/components/ClockSettings.tsx test/clocksettings.test.tsx src/components/Settings.tsx test/settings.test.tsx src/components/NewTab.tsx test/newtab.test.tsx src/styles/global.css
git commit -m "feat: move clock configuration into edit mode"
git push origin feat/speeddial-mvp
```

---

## Self-Review Notes

- **Spec coverage:** adaptive width (Task 1); apple-touch-icon + favicon@128 + onError chain (Task 2); `scrapeBestImage` + `ensureOriginPermission` + manifest wildcard (Task 3); CardEditor "Find better image" opt-in (Task 4); `ClockSettings` + removal from Settings + edit-mode trigger (Task 5). All spec sections map to a task.
- **Type consistency:** `Preview` favicon `next?` used in `images.ts` and `DialCard.onImgError`; `appleTouchIconUrl`/`faviconPreview` consistent; `scrapeBestImage(pageUrl)` and `ensureOriginPermission(pageUrl)` consistent across lib + CardEditor; `ClockSettings({settings,onChange})` consistent with NewTab usage; `StoredImage { data, source:'url', srcUrl }` matches the existing type.
- **Placeholder scan:** none.
- **Regression guard:** Task 5 explicitly DELETES the now-moved `Settings clock options` tests (added in the earlier clock task) so they don't fail after the controls move — flagged so the implementer doesn't leave stale failing tests.
- **Permissions note:** `optional_host_permissions` widened to `https://*/*` + `http://*/*`; nothing is granted at install, only requested per-site on the explicit "Find better image" click. Manual-verify the Chrome permission prompt appears.
```
