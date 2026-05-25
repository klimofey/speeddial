# Clock Format + World Clocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 12h/24h clock-format setting and a world-clocks widget (a configurable row of clocks for chosen IANA time zones) to the SpeedDial new tab.

**Architecture:** A pure `time.ts` module (deterministic `formatTime` + IANA zone helpers) feeds an updated `Clock` (format prop) and a new `WorldClocks` widget. Two additive `Settings` fields (`clockFormat`, `worldClocks`) are managed in the Settings panel and wired through `NewTab`. All logic is unit-tested with Vitest.

**Tech Stack:** TypeScript, Preact, Vite, Vitest + @testing-library/preact, `Intl` (supportedValuesOf / toLocaleTimeString).

---

## File Structure

```
src/lib/time.ts        # NEW: formatTime, listTimeZones, labelForZone
src/lib/types.ts       # MODIFY: + WorldClock, + Settings.clockFormat/worldClocks
src/lib/defaults.ts    # MODIFY: defaults for the two new settings
src/components/Clock.tsx        # MODIFY: format prop, render via formatTime
src/components/WorldClocks.tsx  # NEW
src/components/Settings.tsx     # MODIFY: clock-format select + world-clock manager
src/components/NewTab.tsx       # MODIFY: pass format, render WorldClocks
src/styles/global.css  # MODIFY: world-clock styles
```

---

## Task 1: types, defaults, and `time.ts`

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/defaults.ts`
- Create: `src/lib/time.ts`, `test/time.test.ts`

- [ ] **Step 1: Add types in `src/lib/types.ts`**

Add this interface near the other interfaces (e.g. after `CardSize`/before `Dial` is fine):
```ts
export interface WorldClock {
  id: string;
  timeZone: string;
  label: string;
}
```
In the `Settings` interface, after the `suggestProvider: SuggestProvider;` line add:
```ts
  clockFormat: '24h' | '12h';
  worldClocks: WorldClock[];
```

- [ ] **Step 2: Add defaults in `src/lib/defaults.ts`**

In `DEFAULT_SETTINGS`, after the `suggestProvider: 'duckduckgo',` line add:
```ts
  clockFormat: '24h',
  worldClocks: [],
```

- [ ] **Step 3: Write the failing test `test/time.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { formatTime, listTimeZones, labelForZone } from '../src/lib/time';

describe('formatTime', () => {
  const noonUtc = new Date('2026-05-24T12:00:00Z');

  it('formats 24h without AM/PM', () => {
    expect(formatTime(noonUtc, { timeZone: 'UTC', hour12: false })).toBe('12:00');
  });
  it('formats 12h with AM/PM', () => {
    expect(formatTime(noonUtc, { timeZone: 'UTC', hour12: true })).toBe('12:00 PM');
  });
  it('respects the time zone (New York is UTC-4 in May)', () => {
    expect(formatTime(noonUtc, { timeZone: 'America/New_York', hour12: false })).toBe('08:00');
  });
});

describe('labelForZone', () => {
  it('uses the city segment and replaces underscores', () => {
    expect(labelForZone('America/New_York')).toBe('New York');
  });
  it('returns the input when there is no slash', () => {
    expect(labelForZone('UTC')).toBe('UTC');
  });
});

describe('listTimeZones', () => {
  it('returns a non-empty list including a known zone', () => {
    const zones = listTimeZones();
    expect(zones.length).toBeGreaterThan(0);
    expect(zones).toContain('UTC');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run test/time.test.ts`
Expected: FAIL — cannot resolve `../src/lib/time`.

- [ ] **Step 5: Create `src/lib/time.ts`**

```ts
export function formatTime(date: Date, opts: { timeZone?: string; hour12: boolean }): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: opts.hour12,
    timeZone: opts.timeZone,
  });
}

export function listTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  if (typeof intl.supportedValuesOf === 'function') {
    try {
      return intl.supportedValuesOf('timeZone');
    } catch {
      /* fall through to the minimal fallback */
    }
  }
  return ['UTC'];
}

export function labelForZone(tz: string): string {
  const seg = tz.includes('/') ? tz.slice(tz.lastIndexOf('/') + 1) : tz;
  return seg.replace(/_/g, ' ');
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run test/time.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Run full suite + type-check**

Run: `npm test` → all pass. Run: `npx tsc --noEmit` → 0 errors. (Existing code that constructs a full `Settings` only does so via `DEFAULT_SETTINGS`, which now includes the new fields, so types stay valid.)

- [ ] **Step 8: Commit**

```bash
git add src/lib/types.ts src/lib/defaults.ts src/lib/time.ts test/time.test.ts
git commit -m "feat: add time helpers and clockFormat/worldClocks settings"
```

---

## Task 2: `Clock` format prop

**Files:**
- Modify: `src/components/Clock.tsx`
- Modify: `test/clock.test.tsx`

- [ ] **Step 1: Replace the ENTIRE contents of `test/clock.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { Clock, greeting } from '../src/components/Clock';

describe('greeting', () => {
  it('says good morning at 9am', () => { expect(greeting(9)).toBe('Good morning'); });
  it('says good afternoon at 14', () => { expect(greeting(14)).toBe('Good afternoon'); });
  it('says good evening at 20', () => { expect(greeting(20)).toBe('Good evening'); });
});

describe('Clock', () => {
  beforeEach(() => vi.useFakeTimers().setSystemTime(new Date('2026-05-24T13:05:00')));
  afterEach(() => vi.useRealTimers());

  it('renders a greeting with the name', () => {
    render(<Clock name="Alex" format="24h" />);
    expect(screen.getByText(/Good afternoon, Alex/)).toBeTruthy();
  });

  it('renders 24h time without AM/PM', () => {
    render(<Clock name={null} format="24h" />);
    expect(screen.getByText('13:05')).toBeTruthy();
  });

  it('renders 12h time with PM', () => {
    render(<Clock name={null} format="12h" />);
    expect(screen.getByText('01:05 PM')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/clock.test.tsx`
Expected: FAIL — `Clock` does not accept `format` / renders locale-default time, so the `13:05` / `01:05 PM` assertions fail (or a type error on the prop).

- [ ] **Step 3: Replace the ENTIRE contents of `src/components/Clock.tsx`**

```tsx
import { useEffect, useState } from 'preact/hooks';
import { formatTime } from '../lib/time';

export function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function Clock({ name, format }: { name: string | null; format: '24h' | '12h' }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = formatTime(now, { hour12: format === '12h' });
  const hello = greeting(now.getHours()) + (name ? `, ${name}` : '');
  return (
    <div class="clock">
      <div class="clock-time">{time}</div>
      <div class="clock-greeting">{hello}</div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/clock.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Clock.tsx test/clock.test.tsx
git commit -m "feat: add 12h/24h format prop to Clock"
```

> NOTE: `NewTab` renders `<Clock name=... />` without `format` — this is a type error now, fixed in Task 4. `npm test` for the Clock suite passes; the full `tsc`/build is green again after Task 4.

---

## Task 3: `WorldClocks` component

**Files:**
- Create: `src/components/WorldClocks.tsx`, `test/worldclocks.test.tsx`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Write the failing test `test/worldclocks.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { WorldClocks } from '../src/components/WorldClocks';
import { WorldClock } from '../src/lib/types';

const clocks: WorldClock[] = [
  { id: '1', timeZone: 'UTC', label: 'UTC' },
  { id: '2', timeZone: 'America/New_York', label: 'New York' },
];

describe('WorldClocks', () => {
  beforeEach(() => vi.useFakeTimers().setSystemTime(new Date('2026-05-24T12:00:00Z')));
  afterEach(() => vi.useRealTimers());

  it('renders an item per clock with its label and zone time', () => {
    render(<WorldClocks clocks={clocks} format="24h" />);
    expect(screen.getByText('New York')).toBeTruthy();
    expect(screen.getByText('12:00')).toBeTruthy(); // UTC noon
    expect(screen.getByText('08:00')).toBeTruthy(); // New York (EDT, UTC-4)
  });

  it('renders nothing when there are no clocks', () => {
    const { container } = render(<WorldClocks clocks={[]} format="24h" />);
    expect(container.querySelector('.world-clocks')).toBeNull();
  });

  it('shows --:-- for an invalid time zone', () => {
    render(<WorldClocks clocks={[{ id: 'x', timeZone: 'Not/AZone', label: 'Bad' }]} format="24h" />);
    expect(screen.getByText('--:--')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/worldclocks.test.tsx`
Expected: FAIL — cannot resolve `../src/components/WorldClocks`.

- [ ] **Step 3: Create `src/components/WorldClocks.tsx`**

```tsx
import { useEffect, useState } from 'preact/hooks';
import { WorldClock } from '../lib/types';
import { formatTime } from '../lib/time';

interface Props {
  clocks: WorldClock[];
  format: '24h' | '12h';
}

export function WorldClocks({ clocks, format }: Props) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!clocks.length) return null;

  const renderTime = (tz: string) => {
    try {
      return formatTime(now, { timeZone: tz, hour12: format === '12h' });
    } catch {
      return '--:--';
    }
  };

  return (
    <div class="world-clocks">
      {clocks.map((c) => (
        <div class="world-clock" key={c.id}>
          <span class="world-clock-time">{renderTime(c.timeZone)}</span>
          <span class="world-clock-label">{c.label}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/worldclocks.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Append styles to the END of `src/styles/global.css`**

```css
.world-clocks { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-top: 8px; }
.world-clock { display: flex; flex-direction: column; align-items: center; }
.world-clock-time { font-size: 16px; font-weight: 600; }
.world-clock-label { font-size: 11px; color: var(--muted); }
.wc-list { display: flex; flex-direction: column; gap: 6px; }
.wc-item { display: flex; align-items: center; gap: 8px; }
.wc-item input { flex: 1; min-width: 0; }
.wc-tz { font-size: 11px; color: var(--muted); white-space: nowrap; }
.wc-item button { border: none; background: rgba(0,0,0,.25); color: #fff; border-radius: 6px; width: 22px; height: 22px; cursor: pointer; flex: 0 0 auto; }
```

- [ ] **Step 6: Commit**

```bash
git add src/components/WorldClocks.tsx test/worldclocks.test.tsx src/styles/global.css
git commit -m "feat: add WorldClocks widget"
```

---

## Task 4: Settings panel + NewTab wiring + build

**Files:**
- Modify: `src/components/Settings.tsx`, `src/components/NewTab.tsx`, `test/settings.test.tsx`

- [ ] **Step 1: Update imports in `src/components/Settings.tsx`**

Add `WorldClock` to the `'../lib/types'` import (it currently imports
`Settings as SettingsType, Theme, SearchEngine, CardSize, Background, SuggestProvider`):
```ts
import { Settings as SettingsType, Theme, SearchEngine, CardSize, Background, SuggestProvider, WorldClock } from '../lib/types';
```
Add this import next to the other lib imports:
```ts
import { listTimeZones, labelForZone } from '../lib/time';
```

- [ ] **Step 2: Add world-clock handlers in `src/components/Settings.tsx`**

In the component body, after the existing `onSuggestChange` handler, add:
```tsx
  const addWorldClock = (tz: string) => {
    const wc: WorldClock = { id: 'wc-' + Date.now().toString(36), timeZone: tz, label: labelForZone(tz) };
    onChange({ worldClocks: [...settings.worldClocks, wc] });
  };
  const removeWorldClock = (id: string) => {
    onChange({ worldClocks: settings.worldClocks.filter((c) => c.id !== id) });
  };
  const setWorldClockLabel = (id: string, label: string) => {
    onChange({ worldClocks: settings.worldClocks.map((c) => (c.id === id ? { ...c, label } : c)) });
  };
```

- [ ] **Step 3: Add the JSX in `src/components/Settings.tsx`**

Insert this block immediately AFTER the greeting-name input (the `<input id="se-name" ... />` line) and before the screenshots checkbox:
```tsx
        <label for="se-clockfmt">Clock format</label>
        <select id="se-clockfmt" value={settings.clockFormat}
          onChange={(e) => onChange({ clockFormat: (e.target as HTMLSelectElement).value as '24h' | '12h' })}>
          <option value="24h">24-hour</option>
          <option value="12h">12-hour</option>
        </select>

        <label for="se-addtz">World clocks</label>
        {settings.worldClocks.length > 0 && (
          <div class="wc-list">
            {settings.worldClocks.map((c) => (
              <div class="wc-item" key={c.id}>
                <input aria-label={`Label for ${c.timeZone}`} value={c.label}
                  onInput={(e) => setWorldClockLabel(c.id, (e.target as HTMLInputElement).value)} />
                <span class="wc-tz">{c.timeZone}</span>
                <button aria-label={`Remove ${c.label}`} onClick={() => removeWorldClock(c.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
        <select id="se-addtz" value="" onChange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v) addWorldClock(v); }}>
          <option value="">Add a time zone…</option>
          {listTimeZones().map((tz) => <option value={tz} key={tz}>{tz}</option>)}
        </select>
```

- [ ] **Step 4: Update `src/components/NewTab.tsx`**

Add the import next to the other component imports:
```tsx
import { WorldClocks } from './WorldClocks';
```
Replace the existing clock line in the header:
```tsx
        {settings.showClock && <Clock name={settings.greetingName} />}
```
with:
```tsx
        {settings.showClock && (
          <>
            <Clock name={settings.greetingName} format={settings.clockFormat} />
            <WorldClocks clocks={settings.worldClocks} format={settings.clockFormat} />
          </>
        )}
```

- [ ] **Step 5: Append tests to `test/settings.test.tsx`**

At the END of the file (after the last existing `describe(...)` block), add:
```tsx
describe('Settings clock options', () => {
  it('emits clockFormat when the format select changes', () => {
    const onChange = vi.fn();
    render(<Settings settings={DEFAULT_SETTINGS} onChange={onChange} onClose={() => {}} onRestored={() => {}} />);
    fireEvent.change(screen.getByLabelText('Clock format'), { target: { value: '12h' } });
    expect(onChange).toHaveBeenCalledWith({ clockFormat: '12h' });
  });

  it('adds a world clock when a zone is chosen', () => {
    const onChange = vi.fn();
    render(<Settings settings={DEFAULT_SETTINGS} onChange={onChange} onClose={() => {}} onRestored={() => {}} />);
    fireEvent.change(screen.getByLabelText('World clocks'), { target: { value: 'America/New_York' } });
    expect(onChange).toHaveBeenCalledWith({
      worldClocks: [expect.objectContaining({ timeZone: 'America/New_York', label: 'New York' })],
    });
  });

  it('removes a world clock', () => {
    const onChange = vi.fn();
    const settings = { ...DEFAULT_SETTINGS, worldClocks: [{ id: 'a', timeZone: 'UTC', label: 'UTC' }] };
    render(<Settings settings={settings} onChange={onChange} onClose={() => {}} onRestored={() => {}} />);
    fireEvent.click(screen.getByLabelText('Remove UTC'));
    expect(onChange).toHaveBeenCalledWith({ worldClocks: [] });
  });
});
```
(The `<label for="se-addtz">World clocks</label>` is associated with the add `<select id="se-addtz">`, so `getByLabelText('World clocks')` targets that select.)

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all PASS (existing NewTab test still passes: default `clockFormat` is `'24h'` and `worldClocks` is `[]`, so WorldClocks renders nothing).

- [ ] **Step 7: Type-check and build**

Run: `npx tsc --noEmit` → 0 errors (the Clock `format` prop is now supplied by NewTab).
Run: `npm run build` → clean `dist/`. Confirm no stray emit: `find src test -name '*.js'` returns nothing.

- [ ] **Step 8: Commit and push**

```bash
git add src/components/Settings.tsx src/components/NewTab.tsx test/settings.test.tsx
git commit -m "feat: wire clock format + world clocks into Settings and NewTab"
git push origin feat/speeddial-mvp
```

---

## Self-Review Notes

- **Spec coverage:** `formatTime`/`listTimeZones`/`labelForZone` + invalid-zone fallback (Task 1 + Task 3); `clockFormat` setting + `Clock` format prop (Task 1, Task 2); `WorldClocks` widget render/empty/invalid (Task 3); Settings format select + world-clock add/remove/label-edit (Task 4); NewTab wiring under `showClock` (Task 4); additive schema via existing merge (Task 1, no backup change). All spec sections map to a task.
- **Type consistency:** `WorldClock { id, timeZone, label }` defined in Task 1, used by `WorldClocks` (Task 3), `Settings` (Task 4), and tests. `Settings.clockFormat: '24h' | '12h'` and `worldClocks: WorldClock[]` consistent across Clock/WorldClocks props and Settings handlers. `formatTime(date, { timeZone?, hour12 })` consistent Task 1 ↔ Task 2 ↔ Task 3.
- **Placeholder scan:** none.
- **Sequencing note:** Task 2 leaves `tsc`/build temporarily red (NewTab passes no `format`); Task 4 restores green. Per-task `npm test` (vitest, no type-check) stays green throughout, and the plan calls this out explicitly.
```
