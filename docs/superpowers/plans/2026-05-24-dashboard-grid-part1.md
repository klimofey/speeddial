# Dashboard Grid + Edit Mode (Part 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dial cards resizable (grid spans) and reorderable in an edit mode, on an auto-packing responsive CSS grid — links only (widgets are Part 2).

**Architecture:** A pure `layout.ts` (span clamping + drag→span math) backs a `size` field added to `Dial`. `DialCard` renders its grid span and, in edit mode, a resize handle (mouse-drag) + remove; `DialGrid` runs SortableJS reorder only while editing; `NewTab` owns the edit toggle and wires `resizeDial`. Sizes persist through the existing dial storage; missing sizes default to 1×1.

**Tech Stack:** TypeScript, Preact, Vite, SortableJS, Vitest + @testing-library/preact, CSS Grid (`grid-auto-flow: dense`, spans).

---

## File Structure

```
src/lib/layout.ts        # NEW: MAX_SPAN, RESIZE_STEP_PX, clampSpan, spanFromDelta
src/lib/types.ts         # MODIFY: Dial.size?: { w, h }
src/lib/storage.ts       # MODIFY: getDials defaults missing size to 1x1
src/state/AppState.tsx   # MODIFY: resizeDial action; addDial sets size
src/components/DialCard.tsx  # MODIFY: span style, editing affordances, resize drag
src/components/DialGrid.tsx  # MODIFY: editing prop, gate SortableJS on editing
src/components/NewTab.tsx    # MODIFY: edit-mode toggle, wire resize/editing
src/styles/global.css    # MODIFY: dense grid rows, fill cell, resize handle, edit toggle
```

---

## Task 1: `layout.ts`, `Dial.size`, and storage default

**Files:**
- Create: `src/lib/layout.ts`, `test/layout.test.ts`
- Modify: `src/lib/types.ts`, `src/lib/storage.ts`, `test/storage.test.ts`

- [ ] **Step 1: Write the failing test `test/layout.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { clampSpan, spanFromDelta, MAX_SPAN, RESIZE_STEP_PX } from '../src/lib/layout';

describe('clampSpan', () => {
  it('floors at 1', () => { expect(clampSpan(0)).toBe(1); expect(clampSpan(-3)).toBe(1); });
  it('caps at MAX_SPAN', () => { expect(clampSpan(99)).toBe(MAX_SPAN); });
  it('rounds to the nearest cell', () => { expect(clampSpan(2.4)).toBe(2); expect(clampSpan(2.6)).toBe(3); });
  it('honors a custom max', () => { expect(clampSpan(5, 2)).toBe(2); });
});

describe('spanFromDelta', () => {
  it('grows one span per RESIZE_STEP_PX of positive drag', () => {
    expect(spanFromDelta(1, RESIZE_STEP_PX)).toBe(2);
    expect(spanFromDelta(1, RESIZE_STEP_PX * 2)).toBe(3);
  });
  it('shrinks on negative drag but never below 1', () => {
    expect(spanFromDelta(3, -RESIZE_STEP_PX)).toBe(2);
    expect(spanFromDelta(1, -RESIZE_STEP_PX * 5)).toBe(1);
  });
  it('caps at MAX_SPAN', () => {
    expect(spanFromDelta(1, RESIZE_STEP_PX * 99)).toBe(MAX_SPAN);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/layout.test.ts`
Expected: FAIL — cannot resolve `../src/lib/layout`.

- [ ] **Step 3: Create `src/lib/layout.ts`**

```ts
export const MAX_SPAN = 4;
export const RESIZE_STEP_PX = 80;

export function clampSpan(value: number, max = MAX_SPAN): number {
  return Math.max(1, Math.min(Math.round(value), max));
}

export function spanFromDelta(current: number, deltaPx: number, max = MAX_SPAN): number {
  return clampSpan(current + Math.round(deltaPx / RESIZE_STEP_PX), max);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/layout.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Add `size` to `Dial` in `src/lib/types.ts`**

In the `Dial` interface, after the `order: number;` line add:
```ts
  size?: { w: number; h: number }; // grid span in cells; defaults to 1x1
```

- [ ] **Step 6: Default the size in `src/lib/storage.ts`**

Replace the existing `getDials` function body with:
```ts
export async function getDials(): Promise<Dial[]> {
  const dials = await getSynced<Dial[]>(K_DIALS, []);
  return [...dials]
    .sort((a, b) => a.order - b.order)
    .map((d) => ({ ...d, size: d.size ?? { w: 1, h: 1 } }));
}
```

- [ ] **Step 7: Add a storage test in `test/storage.test.ts`**

Inside the existing `describe('storage', ...)` block, add:
```ts
  it('defaults a missing dial size to 1x1 and preserves an existing size', async () => {
    await chrome.storage.sync.set({ dials: [
      { id: 'a', url: 'https://a.com', title: 'a', imageRef: 'favicon', color: '#000', order: 0 },
      { id: 'b', url: 'https://b.com', title: 'b', imageRef: 'favicon', color: '#000', order: 1, size: { w: 2, h: 2 } },
    ] });
    const got = await storage.getDials();
    expect(got[0].size).toEqual({ w: 1, h: 1 });
    expect(got[1].size).toEqual({ w: 2, h: 2 });
  });
```

- [ ] **Step 8: Run tests + type-check**

Run: `npx vitest run test/layout.test.ts test/storage.test.ts` → PASS.
Run: `npm test` → all pass. Run: `npx tsc --noEmit` → 0 errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/layout.ts test/layout.test.ts src/lib/types.ts src/lib/storage.ts test/storage.test.ts
git commit -m "feat: add grid-span layout helpers and Dial.size with default"
```

---

## Task 2: `resizeDial` in AppState

**Files:**
- Modify: `src/state/AppState.tsx`, `test/appstate.test.tsx`

- [ ] **Step 1: Write the failing test — append to `test/appstate.test.tsx`**

Add this probe component near the top (after the existing `Probe`):
```tsx
function ResizeProbe() {
  const { dials, addDial, resizeDial, ready } = useApp();
  if (!ready) return <span>loading</span>;
  const s = dials[0]?.size;
  return (
    <div>
      <span data-testid="size">{dials[0] ? `${s?.w}x${s?.h}` : '-'}</span>
      <button onClick={() => addDial({ url: 'https://x.com', title: 'X' })}>add</button>
      <button onClick={() => resizeDial(dials[0].id, { w: 2, h: 3 })}>resize</button>
    </div>
  );
}
```
Add this test inside the `describe('AppState', ...)` block:
```tsx
  it('resizes a dial and persists the new size', async () => {
    render(<AppProvider><ResizeProbe /></AppProvider>);
    await waitFor(() => screen.getByText('add'));
    fireEvent.click(screen.getByText('add'));
    await waitFor(() => expect(screen.getByTestId('size').textContent).toBe('1x1'));
    fireEvent.click(screen.getByText('resize'));
    await waitFor(() => expect(screen.getByTestId('size').textContent).toBe('2x3'));
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/appstate.test.tsx`
Expected: FAIL — `resizeDial` is not a function / size is `undefinedxundefined` (addDial doesn't set size yet).

- [ ] **Step 3: Implement in `src/state/AppState.tsx`**

In the `AppContextValue` interface, after `reorderDials` add:
```ts
  resizeDial: (id: string, size: { w: number; h: number }) => Promise<void>;
```
In `addDial`, change the new-dial object to include a size:
```tsx
  const addDial = useCallback(async (input: { url: string; title: string }) => {
    const next = [
      ...dials,
      { id: uid(), url: input.url, title: input.title, imageRef: 'favicon' as const, color: '', order: dials.length, size: { w: 1, h: 1 } },
    ];
    await persistDials(next);
  }, [dials, persistDials]);
```
After `reorderDials`, add:
```tsx
  const resizeDial = useCallback(async (id: string, size: { w: number; h: number }) => {
    await persistDials(dials.map((d) => (d.id === id ? { ...d, size } : d)));
  }, [dials, persistDials]);
```
Add `resizeDial` to the `value` object passed to the provider.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/appstate.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run full suite + commit**

Run: `npm test` → all pass.
```bash
git add src/state/AppState.tsx test/appstate.test.tsx
git commit -m "feat: add resizeDial action and default size on add"
```

---

## Task 3: `DialCard` span + edit affordances + resize drag

**Files:**
- Modify: `src/components/DialCard.tsx`, `test/dialcard.test.tsx`, `src/styles/global.css`

- [ ] **Step 1: Append tests to `test/dialcard.test.tsx`**

Ensure the vitest import includes `vi` and the testing-library import includes `fireEvent` (add if missing — do not duplicate). Add inside the `describe('DialCard', ...)` block:
```tsx
  it('applies a grid span style from size', () => {
    const { container } = render(
      <DialCard dial={{ ...dial, size: { w: 2, h: 3 } }} settings={DEFAULT_SETTINGS} onEdit={() => {}} onDelete={() => {}} />,
    );
    const el = container.querySelector('.dial-card') as HTMLElement;
    expect(el.style.gridColumn).toBe('span 2');
    expect(el.style.gridRow).toBe('span 3');
  });

  it('shows a resize handle only in editing mode', () => {
    const normal = render(<DialCard dial={dial} settings={DEFAULT_SETTINGS} onEdit={() => {}} onDelete={() => {}} />);
    expect(normal.container.querySelector('.dial-resize')).toBeNull();
    const editing = render(<DialCard dial={dial} settings={DEFAULT_SETTINGS} editing onEdit={() => {}} onDelete={() => {}} onResize={() => {}} />);
    expect(editing.container.querySelector('.dial-resize')).toBeTruthy();
  });

  it('resizes via a handle drag (80px per cell)', () => {
    const onResize = vi.fn();
    render(<DialCard dial={{ ...dial, size: { w: 1, h: 1 } }} settings={DEFAULT_SETTINGS} editing onEdit={() => {}} onDelete={() => {}} onResize={onResize} />);
    fireEvent.mouseDown(screen.getByLabelText('Resize GitHub'), { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 160, clientY: 0 });
    expect(onResize).toHaveBeenLastCalledWith('a', { w: 3, h: 1 });
    fireEvent.mouseUp(window);
  });

  it('prevents navigation on click while editing', () => {
    const { container } = render(<DialCard dial={dial} settings={DEFAULT_SETTINGS} editing onEdit={() => {}} onDelete={() => {}} onResize={() => {}} />);
    const link = container.querySelector('.dial-link') as HTMLElement;
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/dialcard.test.tsx`
Expected: FAIL — `.dial-resize` absent, no span style, `editing`/`onResize` props unused.

- [ ] **Step 3: Replace the ENTIRE contents of `src/components/DialCard.tsx`**

```tsx
import { useEffect, useState } from 'preact/hooks';
import { Dial, Settings } from '../lib/types';
import { Preview, resolvePreview, letterFallback } from '../lib/images';
import { spanFromDelta } from '../lib/layout';

interface Props {
  dial: Dial;
  settings: Settings;
  onEdit: (dial: Dial) => void;
  onDelete: (id: string) => void;
  editing?: boolean;
  onResize?: (id: string, size: { w: number; h: number }) => void;
}

export function DialCard({ dial, settings, onEdit, onDelete, editing = false, onResize }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const size = dial.size ?? { w: 1, h: 1 };

  useEffect(() => {
    let alive = true;
    void resolvePreview(dial, settings).then((p) => { if (alive) setPreview(p); });
    return () => { alive = false; };
  }, [dial, settings]);

  const onImgError = () => setPreview(letterFallback(dial));

  // Drag the corner handle: every RESIZE_STEP_PX of movement changes the span by
  // one cell (no DOM measurement needed, so it is robust and testable).
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
        <div class="dial-thumb">
          {preview?.kind === 'image' && <img src={preview.src} alt="" onError={onImgError} />}
          {preview?.kind === 'favicon' && <img class="dial-favicon" src={preview.src} alt="" onError={onImgError} />}
          {preview?.kind === 'letter' && (
            <span class="dial-letter" style={{ background: preview.color }}>{preview.letter}</span>
          )}
        </div>
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/dialcard.test.tsx`
Expected: PASS (existing 3 + 4 new = 7).

- [ ] **Step 5: Update grid/card CSS in `src/styles/global.css`**

Replace the existing `.dial-grid` rule (the one with `grid-template-columns: repeat(auto-fill, minmax(96px, 1fr))`) and its size variants with:
```css
.dial-grid { display: grid; gap: 16px; padding: 24px; max-width: 920px; margin: 0 auto;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); grid-auto-rows: 120px; grid-auto-flow: dense; }
.dial-grid[data-size="sm"] { grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); grid-auto-rows: 92px; }
.dial-grid[data-size="lg"] { grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); grid-auto-rows: 156px; }
```
Replace the existing `.dial-card { position: relative; }` rule with:
```css
.dial-card { position: relative; height: 100%; }
```
Replace the existing `.dial-link { ... }` rule with:
```css
.dial-link { display: flex; flex-direction: column; align-items: center; gap: 8px;
  text-decoration: none; color: var(--fg); height: 100%; }
```
Replace the existing `.dial-thumb { ... }` rule (the one with `aspect-ratio: 1`) with:
```css
.dial-thumb { width: 100%; flex: 1 1 auto; min-height: 0; border-radius: var(--radius); overflow: hidden;
  background: var(--card-bg); box-shadow: var(--card-shadow); border: var(--card-border);
  backdrop-filter: var(--card-blur); display: flex; align-items: center; justify-content: center; }
```
Append these new rules at the END of the file:
```css
.dial-card.editing .dial-actions { display: flex; }
.dial-resize { position: absolute; right: -6px; bottom: -6px; width: 16px; height: 16px;
  border-radius: 4px; background: var(--accent); cursor: nwse-resize; }
```

- [ ] **Step 6: Run full suite + commit**

Run: `npm test` → all pass. Run: `npx tsc --noEmit` → 0 errors.
```bash
git add src/components/DialCard.tsx test/dialcard.test.tsx src/styles/global.css
git commit -m "feat: DialCard grid span, edit affordances, and drag-resize"
```

---

## Task 4: `DialGrid` editing prop + drag-and-drop gating

**Files:**
- Modify: `src/components/DialGrid.tsx`, `test/dialgrid.test.tsx`

- [ ] **Step 1: Append tests to `test/dialgrid.test.tsx`**

Ensure the top has `import Sortable from 'sortablejs';` (the file already `vi.mock('sortablejs', ...)`; add the default import if missing). Add inside the `describe('DialGrid', ...)` block:
```tsx
  it('does not initialize SortableJS when not editing', () => {
    render(<DialGrid dials={dials} settings={DEFAULT_SETTINGS} onEdit={() => {}} onDelete={() => {}} onReorder={() => {}} />);
    expect((Sortable.create as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(0);
  });

  it('initializes SortableJS when editing', () => {
    render(<DialGrid dials={dials} settings={DEFAULT_SETTINGS} editing onEdit={() => {}} onDelete={() => {}} onReorder={() => {}} onResize={() => {}} />);
    expect((Sortable.create as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/dialgrid.test.tsx`
Expected: FAIL — `editing` prop unknown / Sortable currently initializes regardless of editing (the "not editing" test fails because create was called).

- [ ] **Step 3: Replace the ENTIRE contents of `src/components/DialGrid.tsx`**

```tsx
import { useEffect, useRef } from 'preact/hooks';
import Sortable from 'sortablejs';
import { Dial, Settings } from '../lib/types';
import { DialCard } from './DialCard';

interface Props {
  dials: Dial[];
  settings: Settings;
  onEdit: (dial: Dial) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  editing?: boolean;
  onResize?: (id: string, size: { w: number; h: number }) => void;
}

export function DialGrid({ dials, settings, onEdit, onDelete, onReorder, editing = false, onResize }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !editing) return;
    const sortable = Sortable.create(ref.current, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      draggable: '.dial-card',
      onEnd: () => {
        const ids = Array.from(ref.current!.querySelectorAll<HTMLElement>('.dial-card'))
          .map((el) => el.dataset.id!)
          .filter(Boolean);
        onReorder(ids);
      },
    });
    return () => sortable.destroy();
  }, [editing, onReorder]);

  return (
    <div class="dial-grid" data-size={settings.cardSize} ref={ref}>
      {dials.map((dial) => (
        <DialCard
          key={dial.id}
          dial={dial}
          settings={settings}
          onEdit={onEdit}
          onDelete={onDelete}
          editing={editing}
          onResize={onResize}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/dialgrid.test.tsx`
Expected: PASS (existing 2 + 2 new = 4).

- [ ] **Step 5: Run full suite + commit**

Run: `npm test` → all pass. Run: `npx tsc --noEmit` → 0 errors.
```bash
git add src/components/DialGrid.tsx test/dialgrid.test.tsx
git commit -m "feat: gate SortableJS drag-and-drop to edit mode in DialGrid"
```

---

## Task 5: `NewTab` edit-mode toggle + wiring + build

**Files:**
- Modify: `src/components/NewTab.tsx`, `test/newtab.test.tsx`, `src/styles/global.css`

- [ ] **Step 1: Append a test to `test/newtab.test.tsx`**

Add inside the `describe('NewTab', ...)` block:
```tsx
  it('toggles edit mode via the Edit button', async () => {
    render(<NewTab />);
    await waitFor(() => screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByText('Done')).toBeTruthy();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/newtab.test.tsx`
Expected: FAIL — no "Edit" button.

- [ ] **Step 3: Edit `src/components/NewTab.tsx`**

Add `resizeDial` to the `useApp()` destructure:
```tsx
  const { ready, dials, settings, addDial, updateDial, removeDial, reorderDials, resizeDial, updateSettings, reload } = useApp();
```
Add edit-mode state after the `showSettings` state line:
```tsx
  const [editMode, setEditMode] = useState(false);
```
Add an Edit/Done toggle button right after the settings-gear button line:
```tsx
      <button class="edit-toggle" onClick={() => setEditMode((v) => !v)}>{editMode ? 'Done' : 'Edit'}</button>
```
Pass the new props to `DialGrid` (replace the existing `<DialGrid ... />` line):
```tsx
      <DialGrid dials={visible} settings={settings} editing={editMode} onEdit={(d) => setEditing(d)} onDelete={removeDial} onReorder={reorderDials} onResize={resizeDial} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/newtab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Append edit-toggle styles to the END of `src/styles/global.css`**

```css
.edit-toggle { position: fixed; top: 16px; right: 62px; border: var(--card-border); cursor: pointer;
  background: var(--card-bg); color: var(--card-fg); box-shadow: var(--card-shadow);
  height: 38px; padding: 0 16px; border-radius: 19px; font-size: 13px; }
```

- [ ] **Step 6: Run the full suite, type-check, and build**

Run: `npm test` → all pass.
Run: `npx tsc --noEmit` → 0 errors.
Run: `npm run build` → clean `dist/`. Confirm `find src test -name '*.js'` returns nothing.

- [ ] **Step 7: Commit and push**

```bash
git add src/components/NewTab.tsx test/newtab.test.tsx src/styles/global.css
git commit -m "feat: add dashboard edit-mode toggle and wire resize/reorder"
git push origin feat/speeddial-mvp
```

---

## Self-Review Notes

- **Spec coverage:** `Dial.size` + migration default (Task 1); `layout.ts` clamp/step (Task 1); `resizeDial` + addDial size (Task 2); grid span render + responsive dense grid + 1×1-fills-cell (Task 3 CSS + DialCard span); edit-mode resize handle + remove + prevent-nav (Task 3); **drag-and-drop reorder gated to edit mode** (Task 4); edit toggle + wiring (Task 5). All spec sections map to a task.
- **Type consistency:** `size?: { w: number; h: number }` consistent across `Dial`, `resizeDial`, `DialCard`/`DialGrid` `onResize`, and the `style` span; `spanFromDelta`/`clampSpan`/`MAX_SPAN`/`RESIZE_STEP_PX` consistent Task 1 ↔ Task 3; `editing` optional prop consistent DialCard ↔ DialGrid ↔ NewTab.
- **Placeholder scan:** none.
- **Incremental tsc:** every task ends tsc-clean because `size`, `editing`, and `onResize` are all optional, so partially-wired states still type-check.
- **Visual tunability flagged:** the grid-auto-rows heights (92/120/156) and resize step (80px) are first-pass values; the user expects to fine-tune the look after seeing it ("если что пофиксим").
```
