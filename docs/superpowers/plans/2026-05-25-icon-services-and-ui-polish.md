# Icon Services + Quiet Preview + UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add keyless icon-service candidates to the image gallery, quiet the default preview (no apple-touch 404), center+fill the Recent row, and make the clock an in-place editable widget block.

**Architecture:** `iconSources` (domain-derived URLs, no fetch) feeds the CardEditor gallery instantly; `scrapeImages` results are appended after permission; the default `faviconPreview` drops apple-touch; Recent gets centered with a higher count; the clock gains a dashed edit block with a gear.

**Tech Stack:** TypeScript, Preact, Vitest + @testing-library/preact.

---

## File Structure

```
src/lib/images.ts            # MODIFY: faviconPreview → favicon@128 only; remove appleTouchIconUrl
src/lib/metascrape.ts        # MODIFY: + iconSources(pageUrl)
src/components/CardEditor.tsx # MODIFY: icons-instant + scrape-append flow
src/components/NewTab.tsx     # MODIFY: Recent limit/center; clock widget block + gear (remove Clock button)
src/styles/global.css         # MODIFY: recent center, widget-edit/gear, remove clock-config-btn
```

---

## Task 1: Quiet default preview (drop apple-touch)

**Files:**
- Modify: `src/lib/images.ts`, `test/images.test.ts`, `test/cardthumb.test.tsx`, `test/dialcard.test.tsx`

- [ ] **Step 1: Update `test/images.test.ts`**

Remove `appleTouchIconUrl` from the import from `../src/lib/images`. Delete the test `it('builds an apple-touch-icon URL at the site origin', ...)`. Replace the test `it('favicon preview prefers apple-touch-icon with a favicon@128 fallback', ...)` with:
```ts
  it('favicon preview uses a 128px Chrome favicon (no apple-touch)', async () => {
    const r = await resolvePreview(dial({ imageRef: 'favicon', url: 'https://github.com' }), settings);
    expect(r.kind).toBe('favicon');
    expect((r as { src: string }).src).toContain('/_favicon/');
    expect((r as { src: string }).src).toContain('size=128');
    expect((r as { src: string }).src).not.toContain('apple-touch-icon');
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/images.test.ts`
Expected: FAIL — import of `appleTouchIconUrl` errors / favicon src still apple-touch.

- [ ] **Step 3: Edit `src/lib/images.ts`**

Delete the `export function appleTouchIconUrl(...) { ... }` function entirely. Replace `faviconPreview` with:
```ts
// Default favicon preview: Chrome's 128px favicon (returns a generic icon rather
// than 404ing). Crisp alternatives are offered on demand in the editor gallery.
function faviconPreview(pageUrl: string): Preview {
  return { kind: 'favicon', src: faviconUrl(pageUrl, 128) };
}
```
Leave the `Preview` `favicon` variant's optional `next?` field as-is (now unset); `CardThumb`'s existing `onImgError` consequently falls straight to the letter tile.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/images.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `test/cardthumb.test.tsx`**

Replace the test `it('renders an image for a favicon dial and cascades apple-touch -> favicon -> letter on error', ...)` with:
```tsx
  it('renders a favicon image and falls back to the letter on error', async () => {
    const { container } = render(
      <CardThumb dial={{ ...dial, imageRef: 'favicon' }} settings={DEFAULT_SETTINGS} />,
    );
    await waitFor(() => expect(container.querySelector('img')).toBeTruthy());
    fireEvent.error(container.querySelector('img')!);
    await waitFor(() => expect(screen.getByText('G')).toBeTruthy());
  });
```

- [ ] **Step 6: Update `test/dialcard.test.tsx`**

Delete the test `it('falls back apple-touch-icon -> favicon -> letter on image errors', ...)` (thumbnail-fallback behavior is now covered by `CardThumb`). Leave all other DialCard tests unchanged.

- [ ] **Step 7: Run the affected suites**

Run: `npx vitest run test/images.test.ts test/cardthumb.test.tsx test/dialcard.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/images.ts test/images.test.ts test/cardthumb.test.tsx test/dialcard.test.tsx
git commit -m "feat: quiet default preview (drop apple-touch auto-attempt)"
```

---

## Task 2: `iconSources`

**Files:**
- Modify: `src/lib/metascrape.ts`, `test/metascrape.test.ts`

- [ ] **Step 1: Add a test to `test/metascrape.test.ts`**

Add `iconSources` to the import from `../src/lib/metascrape`. Append:
```ts
describe('iconSources', () => {
  it('builds three keyless icon-service URLs from the host', () => {
    expect(iconSources('https://translate.google.com/path?x=1')).toEqual([
      'https://www.google.com/s2/favicons?domain=translate.google.com&sz=256',
      'https://icons.duckduckgo.com/ip3/translate.google.com.ico',
      'https://icon.horse/icon/translate.google.com',
    ]);
  });
  it('returns [] for an invalid URL', () => {
    expect(iconSources('not a url')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/metascrape.test.ts`
Expected: FAIL — `iconSources` not exported.

- [ ] **Step 3: Append to `src/lib/metascrape.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/metascrape.test.ts`
Expected: PASS (scrapeImages tests + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/metascrape.ts test/metascrape.test.ts
git commit -m "feat: add keyless icon-service URL builder"
```

---

## Task 3: CardEditor — icons instantly, scrape appends

**Files:**
- Modify: `src/components/CardEditor.tsx`, `test/cardeditor.test.tsx`

- [ ] **Step 1: Replace the scrape-flow tests in `test/cardeditor.test.tsx`**

Keep the metascrape mock as `scrapeImages` (returns two URLs). Replace the four M3 scrape tests with:
```tsx
  it('shows icon-service candidates immediately, before any permission', async () => {
    const { container } = render(<CardEditor settings={DEFAULT_SETTINGS} onSave={() => {}} onClose={() => {}} />);
    fireEvent.input(screen.getByLabelText('URL'), { target: { value: 'https://github.com' } });
    fireEvent.click(screen.getByText('Find better image'));
    await waitFor(() => expect(container.querySelectorAll('.ce-candidate').length).toBe(3));
    expect(screen.getByText('Allow access')).toBeTruthy();
  });

  it('appends scraped page images after Allow access; picking one saves a meta- image', async () => {
    const onSave = vi.fn();
    const { container } = render(<CardEditor settings={DEFAULT_SETTINGS} onSave={onSave} onClose={() => {}} />);
    fireEvent.input(screen.getByLabelText('URL'), { target: { value: 'https://github.com' } });
    fireEvent.click(screen.getByText('Find better image'));
    await waitFor(() => expect(container.querySelectorAll('.ce-candidate').length).toBe(3));
    fireEvent.click(screen.getByText('Allow access'));
    await waitFor(() => expect(container.querySelectorAll('.ce-candidate').length).toBe(5)); // 3 icons + 2 scraped
    fireEvent.click(container.querySelectorAll('.ce-candidate')[4]);
    await waitFor(() => expect(screen.getByText(/Selected/)).toBeTruthy());
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ imageRef: expect.stringMatching(/^meta-/) }));
  });

  it('scrapes directly (no Allow access) when permission is already granted', async () => {
    const perms = await import('../src/lib/permissions');
    (perms.hasOriginPermission as unknown as { mockResolvedValueOnce: (v: boolean) => void }).mockResolvedValueOnce(true);
    const { container } = render(<CardEditor settings={DEFAULT_SETTINGS} onSave={() => {}} onClose={() => {}} />);
    fireEvent.input(screen.getByLabelText('URL'), { target: { value: 'https://github.com' } });
    fireEvent.click(screen.getByText('Find better image'));
    await waitFor(() => expect(container.querySelectorAll('.ce-candidate').length).toBe(5));
    expect(screen.queryByText('Allow access')).toBeNull();
  });

  it('shows guidance when access is denied (icons remain)', async () => {
    const perms = await import('../src/lib/permissions');
    (perms.ensureOriginPermission as unknown as { mockResolvedValueOnce: (v: boolean) => void }).mockResolvedValueOnce(false);
    const { container } = render(<CardEditor settings={DEFAULT_SETTINGS} onSave={() => {}} onClose={() => {}} />);
    fireEvent.input(screen.getByLabelText('URL'), { target: { value: 'https://github.com' } });
    fireEvent.click(screen.getByText('Find better image'));
    await waitFor(() => screen.getByText('Allow access'));
    fireEvent.click(screen.getByText('Allow access'));
    await waitFor(() => expect(screen.getByText(/Access denied/)).toBeTruthy());
    expect(container.querySelectorAll('.ce-candidate').length).toBe(3); // icons still there
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/cardeditor.test.tsx`
Expected: FAIL — `iconSources` not used; gallery not populated before permission.

- [ ] **Step 3: Edit `src/components/CardEditor.tsx`**

Update the metascrape import to include `iconSources`:
```tsx
import { scrapeImages, iconSources } from '../lib/metascrape';
```
Replace the `hostOf`, `doScrape`, `findBetterImage`, and `allowAccess` functions with:
```tsx
  const mergeUnique = (base: string[], more: string[]) => {
    const out = [...base];
    for (const u of more) if (!out.includes(u)) out.push(u);
    return out;
  };

  const doScrape = async (base: string[]) => {
    setScrapeStep('searching');
    setScrapeMsg('Scanning the page…');
    setBusy(true);
    const imgs = await scrapeImages(normalizeUrl(url));
    setBusy(false);
    setScrapeStep('idle');
    setCandidates(mergeUnique(base, imgs));
    setScrapeMsg(imgs.length ? `Found ${imgs.length} more on the page — pick one.` : 'No extra images on the page.');
  };

  const findBetterImage = async () => {
    setScrapeMsg('');
    setBusy(true);
    const icons = iconSources(normalizeUrl(url));
    setCandidates(icons);
    const granted = await hasOriginPermission(normalizeUrl(url));
    setBusy(false);
    if (granted) { await doScrape(icons); return; }
    setScrapeStep('need-perm');
    setScrapeMsg('Pick an icon, or "Allow access" to scan the page for more.');
  };

  const allowAccess = async () => {
    setBusy(true);
    const granted = await ensureOriginPermission(normalizeUrl(url));
    setBusy(false);
    if (granted) { await doScrape(candidates); return; }
    setScrapeStep('denied');
    setScrapeMsg('Access denied. Click "Allow access" to try again, or grant it manually in chrome://extensions → SpeedDial → Details → Site access.');
  };
```
(The old `hostOf` helper is removed — it is no longer referenced, which keeps `noUnusedLocals` happy. The `selectCandidate` handler, the gallery JSX, and the live preview are unchanged.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/cardeditor.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CardEditor.tsx test/cardeditor.test.tsx
git commit -m "feat: offer icon-service candidates instantly, append page scrape"
```

---

## Task 4: Recent row — center + fill

**Files:**
- Modify: `src/components/NewTab.tsx`, `src/styles/global.css`

- [ ] **Step 1: Center the Recent tiles in `src/styles/global.css`**

In the `.recent-tiles` rule, add `justify-content: center;`. The rule becomes:
```css
.recent-tiles { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
```

- [ ] **Step 2: Raise the Recent count in `src/components/NewTab.tsx`**

In the recent-loading effect, change the `getRecentSites` call to pass `limit: 16`:
```tsx
    void getRecentSites({ excludeUrls: dials.map((d) => d.url), limit: 16 }).then((sites) => {
      setRecentSites(sites);
      setRecentLoading(false);
    });
```
(Leave the rest of the effect unchanged.)

- [ ] **Step 3: Verify + commit**

Run: `npm test` → all pass (no test asserts the count/alignment). Run: `npx tsc --noEmit` → 0 errors.
```bash
git add src/components/NewTab.tsx src/styles/global.css
git commit -m "feat: center the Recent row and fill more of the wide layout"
```

---

## Task 5: Clock as an editable widget block + gear; build & push

**Files:**
- Modify: `src/components/NewTab.tsx`, `test/newtab.test.tsx`, `src/styles/global.css`

- [ ] **Step 1: Update the NewTab clock-config test in `test/newtab.test.tsx`**

Replace the existing test `it('opens clock config from edit mode', ...)` with:
```tsx
  it('opens clock config from the gear in edit mode', async () => {
    render(<NewTab />);
    await waitFor(() => screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.queryByText('Clock')).toBeNull(); // no separate Clock button anymore
    fireEvent.click(screen.getByLabelText('Clock settings'));
    expect(screen.getByLabelText('Show clock')).toBeTruthy();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/newtab.test.tsx`
Expected: FAIL — still a "Clock" button / no "Clock settings" gear.

- [ ] **Step 3: Edit `src/components/NewTab.tsx`**

Remove the Clock toggle button line:
```tsx
      {editMode && <button class="edit-toggle clock-config-btn" onClick={() => setShowClockConfig(true)}>Clock</button>}
```
Replace the clock block in the header:
```tsx
        {settings.showClock && (
          <>
            <Clock name={settings.greetingName} format={settings.clockFormat} />
            <WorldClocks clocks={settings.worldClocks} format={settings.clockFormat} />
          </>
        )}
```
…wait — that block was already changed to the flanking clock-row in Task F1/this round's Recent? Use the CURRENT clock block (the one rendering `.clock-row` with `leftClocks`/`rightClocks`). Replace the CURRENT `{settings.showClock && ( ... )}` clock block with:
```tsx
        {settings.showClock && (
          <div class={`clock-widget${editMode ? ' widget-edit' : ''}`}>
            {editMode && (
              <button class="widget-gear" aria-label="Clock settings" onClick={() => setShowClockConfig(true)}>⚙</button>
            )}
            <div class="clock-row">
              <WorldClocks clocks={leftClocks} format={settings.clockFormat} />
              <Clock name={settings.greetingName} format={settings.clockFormat} />
              <WorldClocks clocks={rightClocks} format={settings.clockFormat} />
            </div>
          </div>
        )}
```
Leave the `showClockConfig` state and the `{showClockConfig && (<modal>...ClockSettings...)}` block unchanged.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/newtab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Update `src/styles/global.css`**

Remove the `.clock-config-btn { right: 118px; }` rule. Append:
```css
.clock-widget { position: relative; }
.widget-edit { border: 1px dashed var(--muted); border-radius: 16px; padding: 12px 12px 8px; }
.widget-gear { position: absolute; top: 6px; right: 6px; border: none; cursor: pointer;
  background: var(--card-bg); color: var(--card-fg); box-shadow: var(--card-shadow);
  width: 28px; height: 28px; border-radius: 50%; font-size: 13px; }
```

- [ ] **Step 6: Full suite, type-check, build, push**

Run: `npm test` → all pass (report count). Run: `npx tsc --noEmit` → 0 errors.
Run: `npm run build` → clean `dist/`; `find src test -name '*.js'` returns nothing.
```bash
git add src/components/NewTab.tsx test/newtab.test.tsx src/styles/global.css
git commit -m "feat: edit the clock as a widget block (dashed outline + gear)"
git push origin feat/speeddial-mvp
```

---

## Self-Review Notes

- **Spec coverage:** quiet preview / drop apple-touch (Task 1); `iconSources` (Task 2); CardEditor icons-instant + scrape-append (Task 3); Recent center+fill (Task 4); clock widget block + gear, remove Clock button (Task 5). All spec sections map to a task.
- **Type consistency:** `iconSources(pageUrl): string[]` consistent metascrape ↔ CardEditor; `doScrape(base: string[])` takes the base list at both call sites; `faviconPreview` returns the `favicon` `Preview` variant; `getRecentSites({excludeUrls, limit})` matches the existing signature; `widget-gear`/`widget-edit`/`clock-widget` classes consistent JSX ↔ CSS.
- **Placeholder scan:** none.
- **Regression guards flagged:** Task 1 removes the two-step apple-touch cascade tests (cardthumb + dialcard) since the auto-preview no longer attempts apple-touch; Task 3 replaces the M3 "Found N images" single-source tests with icon+scrape gallery tests; Task 5 removes the "Clock" button and its test in favor of the gear.
- **`hostOf` removal:** Task 3 drops the now-unused `hostOf` helper to satisfy `noUnusedLocals`.
```
