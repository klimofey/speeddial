# Flanking World Clocks + Permission UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flank the main clock with the world clocks (half left, half right, smaller) and give "Find better image" a clear permission flow (check → explain → retry → guidance).

**Architecture:** A pure `splitWorldClocks` helper feeds a centered clock-row layout in `NewTab`; a `hasOriginPermission` check plus a small `scrapeStep` state machine in `CardEditor` replace the one-shot permission request.

**Tech Stack:** TypeScript, Preact, Vitest + @testing-library/preact, `chrome.permissions`.

---

## File Structure

```
src/lib/time.ts              # MODIFY: + splitWorldClocks
src/lib/permissions.ts       # MODIFY: + hasOriginPermission
src/components/NewTab.tsx     # MODIFY: centered clock-row, flanking world clocks
src/components/CardEditor.tsx # MODIFY: permission flow (check/explain/retry/guidance)
src/styles/global.css         # MODIFY: .clock-row + flanking column layout + .ce-find-row
```

---

## Task 1: Flanking world clocks

**Files:**
- Modify: `src/lib/time.ts`, `test/time.test.ts`, `src/components/NewTab.tsx`, `src/styles/global.css`

- [ ] **Step 1: Add a test to `test/time.test.ts`**

Add `splitWorldClocks` to the import from `../src/lib/time`. Add:
```ts
describe('splitWorldClocks', () => {
  it('splits an even count in half', () => {
    expect(splitWorldClocks([1, 2, 3, 4])).toEqual({ left: [1, 2], right: [3, 4] });
  });
  it('puts the extra item on the left for an odd count', () => {
    expect(splitWorldClocks([1, 2, 3])).toEqual({ left: [1, 2], right: [3] });
  });
  it('handles an empty list', () => {
    expect(splitWorldClocks([])).toEqual({ left: [], right: [] });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/time.test.ts`
Expected: FAIL — `splitWorldClocks` not exported.

- [ ] **Step 3: Add `splitWorldClocks` to `src/lib/time.ts`**

Append:
```ts
export function splitWorldClocks<T>(clocks: T[]): { left: T[]; right: T[] } {
  const mid = Math.ceil(clocks.length / 2);
  return { left: clocks.slice(0, mid), right: clocks.slice(mid) };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/time.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `src/components/NewTab.tsx`**

Add to the `'../lib/time'`-area imports (add a new import line if none exists):
```tsx
import { splitWorldClocks } from '../lib/time';
```
After the `if (!ready) return null;` line, add:
```tsx
  const { left: leftClocks, right: rightClocks } = splitWorldClocks(settings.worldClocks);
```
Replace the existing clock block:
```tsx
        {settings.showClock && (
          <>
            <Clock name={settings.greetingName} format={settings.clockFormat} />
            <WorldClocks clocks={settings.worldClocks} format={settings.clockFormat} />
          </>
        )}
```
with:
```tsx
        {settings.showClock && (
          <div class="clock-row">
            <WorldClocks clocks={leftClocks} format={settings.clockFormat} />
            <Clock name={settings.greetingName} format={settings.clockFormat} />
            <WorldClocks clocks={rightClocks} format={settings.clockFormat} />
          </div>
        )}
```

- [ ] **Step 6: Append styles to `src/styles/global.css`**

```css
.clock-row { display: flex; align-items: center; justify-content: center; gap: 24px; flex-wrap: wrap; }
.clock-row .world-clocks { flex-direction: column; gap: 6px; margin-top: 0; }
```

- [ ] **Step 7: Verify + commit**

Run: `npm test` → all pass (existing NewTab tests still pass: no world clocks by default, so the flanking `WorldClocks` render `null` and only the main clock shows). Run: `npx tsc --noEmit` → 0 errors.
```bash
git add src/lib/time.ts test/time.test.ts src/components/NewTab.tsx src/styles/global.css
git commit -m "feat: flank the main clock with world clocks split left/right"
```

---

## Task 2: `hasOriginPermission`

**Files:**
- Modify: `src/lib/permissions.ts`, `test/permissions.test.ts`

- [ ] **Step 1: Add tests to `test/permissions.test.ts`**

Add `hasOriginPermission` to the import. Append:
```ts
describe('hasOriginPermission', () => {
  it('checks contains with the origin pattern and returns true', async () => {
    mockChrome.permissions.contains.mockResolvedValueOnce(true);
    expect(await hasOriginPermission('https://github.com/x')).toBe(true);
    expect(mockChrome.permissions.contains).toHaveBeenCalledWith({ origins: ['https://github.com/*'] });
  });
  it('returns false when not contained', async () => {
    mockChrome.permissions.contains.mockResolvedValueOnce(false);
    expect(await hasOriginPermission('https://x.com')).toBe(false);
  });
  it('returns false for an invalid URL', async () => {
    expect(await hasOriginPermission('nope')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/permissions.test.ts`
Expected: FAIL — `hasOriginPermission` not exported.

- [ ] **Step 3: Append to `src/lib/permissions.ts`**

```ts
export async function hasOriginPermission(pageUrl: string): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.contains) return false;
  let pattern: string;
  try {
    pattern = new URL(pageUrl).origin + '/*';
  } catch {
    return false;
  }
  try {
    return await chrome.permissions.contains({ origins: [pattern] });
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/permissions.test.ts`
Expected: PASS (existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/permissions.ts test/permissions.test.ts
git commit -m "feat: add hasOriginPermission check"
```

---

## Task 3: CardEditor permission flow + build

**Files:**
- Modify: `src/components/CardEditor.tsx`, `test/cardeditor.test.tsx`, `src/styles/global.css`

- [ ] **Step 1: Replace the CardEditor scrape test in `test/cardeditor.test.tsx`**

Update the permissions mock at the top to include `hasOriginPermission`, and replace the existing `'finds a better image and saves it as the card image'` test with the three tests below. The mocks:
```tsx
vi.mock('../src/lib/permissions', () => ({
  hasOriginPermission: vi.fn(async () => false),
  ensureOriginPermission: vi.fn(async () => true),
}));
vi.mock('../src/lib/metascrape', () => ({ scrapeBestImage: vi.fn(async () => 'https://cdn.example/hero.png') }));
```
The tests (inside `describe('CardEditor', ...)`):
```tsx
  it('grants access then finds a better image (two-step)', async () => {
    const onSave = vi.fn();
    render(<CardEditor settings={DEFAULT_SETTINGS} onSave={onSave} onClose={() => {}} />);
    fireEvent.input(screen.getByLabelText('URL'), { target: { value: 'https://github.com' } });
    fireEvent.click(screen.getByText('Find better image'));
    await waitFor(() => screen.getByText('Allow access'));
    fireEvent.click(screen.getByText('Allow access'));
    await waitFor(() => expect(screen.getByText(/Found a better image/)).toBeTruthy());
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ imageRef: expect.stringMatching(/^meta-/) }));
  });

  it('skips the prompt when permission is already granted', async () => {
    const perms = await import('../src/lib/permissions');
    (perms.hasOriginPermission as unknown as { mockResolvedValueOnce: (v: boolean) => void }).mockResolvedValueOnce(true);
    render(<CardEditor settings={DEFAULT_SETTINGS} onSave={() => {}} onClose={() => {}} />);
    fireEvent.input(screen.getByLabelText('URL'), { target: { value: 'https://github.com' } });
    fireEvent.click(screen.getByText('Find better image'));
    await waitFor(() => expect(screen.getByText(/Found a better image/)).toBeTruthy());
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/cardeditor.test.tsx`
Expected: FAIL — `hasOriginPermission` not used yet / no "Allow access" button / single-shot flow.

- [ ] **Step 3: Edit `src/components/CardEditor.tsx`**

Update the permissions import to include `hasOriginPermission`:
```tsx
import { ensureOriginPermission, hasOriginPermission } from '../lib/permissions';
```
Replace the existing `const [scrapeMsg, setScrapeMsg] = useState('');` with:
```tsx
  const [scrapeMsg, setScrapeMsg] = useState('');
  const [scrapeStep, setScrapeStep] = useState<'idle' | 'need-perm' | 'searching' | 'denied'>('idle');
```
Replace the existing `findBetterImage` handler with these three functions:
```tsx
  const hostOf = (raw: string) => {
    try { return new URL(normalizeUrl(raw)).host; } catch { return raw; }
  };

  const doScrape = async () => {
    const finalUrl = normalizeUrl(url);
    setScrapeStep('searching');
    setScrapeMsg('Searching…');
    setBusy(true);
    const img = await scrapeBestImage(finalUrl);
    if (!img) { setBusy(false); setScrapeStep('idle'); setScrapeMsg('No better image found.'); return; }
    const ref = 'meta-' + Date.now().toString(36);
    await setImage(ref, { data: img, source: 'url', srcUrl: img });
    setUploadRef(ref);
    setMode('upload');
    setBusy(false);
    setScrapeStep('idle');
    setScrapeMsg('Found a better image ✓');
  };

  const findBetterImage = async () => {
    setBusy(true);
    setScrapeMsg('');
    const granted = await hasOriginPermission(normalizeUrl(url));
    setBusy(false);
    if (granted) { await doScrape(); return; }
    setScrapeStep('need-perm');
    setScrapeMsg(`SpeedDial needs one-time access to ${hostOf(url)}. Chrome will ask — click Allow.`);
  };

  const allowAccess = async () => {
    setBusy(true);
    const granted = await ensureOriginPermission(normalizeUrl(url));
    setBusy(false);
    if (granted) { await doScrape(); return; }
    setScrapeStep('denied');
    setScrapeMsg('Access denied. Click "Allow access" to try again, or grant it manually in chrome://extensions → SpeedDial → Details → Site access.');
  };
```
Replace the existing "Find better image" button block (the `{url.trim() && (<button class="ce-find" ...>Find better image</button>)}` and the `{scrapeMsg && ...}` line) with:
```tsx
        {url.trim() && (
          <div class="ce-find-row">
            <button type="button" class="ce-find" onClick={findBetterImage} disabled={busy}>Find better image</button>
            {(scrapeStep === 'need-perm' || scrapeStep === 'denied') && (
              <button type="button" class="ce-find" onClick={allowAccess} disabled={busy}>Allow access</button>
            )}
          </div>
        )}
        {scrapeMsg && <p class="settings-msg">{scrapeMsg}</p>}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/cardeditor.test.tsx`
Expected: PASS (existing non-scrape tests + 3 new scrape-flow tests).

- [ ] **Step 5: Append a style to `src/styles/global.css`**

```css
.ce-find-row { display: flex; gap: 8px; flex-wrap: wrap; }
```

- [ ] **Step 6: Full suite, type-check, build, push**

Run: `npm test` → all pass (report count). Run: `npx tsc --noEmit` → 0 errors.
Run: `npm run build` → clean `dist/`; `find src test -name '*.js'` returns nothing.
```bash
git add src/components/CardEditor.tsx test/cardeditor.test.tsx src/styles/global.css
git commit -m "feat: clearer permission flow for Find better image"
git push origin feat/speeddial-mvp
```

---

## Self-Review Notes

- **Spec coverage:** `splitWorldClocks` + flanking layout + CSS (Task 1); `hasOriginPermission` (Task 2); CardEditor check→explain→retry→guidance flow with `scrapeStep`, host-in-message, and the manual-grant hint (Task 3). All spec sections map to a task.
- **Type consistency:** `splitWorldClocks<T>` returns `{left,right}` used in NewTab; `hasOriginPermission(pageUrl)` mirrors `ensureOriginPermission(pageUrl)`; `scrapeStep` union values are consistent between state, handlers, and JSX; `StoredImage { data, source:'url', srcUrl }` unchanged.
- **Placeholder scan:** none.
- **Regression guard:** Task 3 replaces the single P4 scrape test (its one-shot flow no longer exists) with the three new flow tests — flagged so no stale test remains.
- **Manual-verify note:** the Chrome host-permission prompt only appears in a real browser; in tests `chrome.permissions.request/contains` are mocked.
```
