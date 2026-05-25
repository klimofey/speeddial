# SpeedDial Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a free, privacy-first Chrome (Manifest V3) new-tab speed dial with drag-and-drop cards, per-site previews, switchable/custom themes, search, clock, and JSON/ZIP backup.

**Architecture:** A Preact app bundled by Vite + @crxjs/vite-plugin, served as the `newtab` override. Pure-logic modules (`storage`, `themes`, `images`, `backup`) are framework-agnostic and unit-tested with Vitest against a mocked `chrome.*` API. UI components consume state through a Preact context. Card metadata + settings live in `chrome.storage.sync`; heavy images/backgrounds live in `chrome.storage.local`.

**Tech Stack:** TypeScript, Preact, Vite, @crxjs/vite-plugin, SortableJS (drag-and-drop), fflate (ZIP), Vitest + @testing-library/preact.

---

## File Structure

```
speeddial/
  package.json
  tsconfig.json
  vite.config.ts
  manifest.config.ts          # MV3 manifest (typed)
  index.html                  # newtab entry
  test/
    setup.ts                  # chrome.* mock + jsdom globals
  src/
    main.tsx                  # mounts <NewTab>
    lib/
      types.ts                # shared types + SCHEMA_VERSION
      defaults.ts             # built-in themes, default settings
      storage.ts              # sync/local split, quota fallback
      themes.ts               # apply theme via CSS vars, resolve active
      images.ts               # favicon / url-cache / screenshot / fallback cascade
      backup.ts               # snapshot, JSON + ZIP export/import, validate
      color.ts                # deterministic color + initial from url/title
    state/
      AppState.tsx            # Preact context: dials, settings, actions
    components/
      NewTab.tsx
      Clock.tsx
      SearchBar.tsx
      DialGrid.tsx
      DialCard.tsx
      CardEditor.tsx
      Settings.tsx
      ThemePicker.tsx
    styles/
      global.css              # layout + CSS-variable consumption
  README.md
```

Each `lib/*` module has one responsibility and a small exported surface. Components are split by responsibility (one component per file). Files that change together (a component and nothing else) stay isolated so edits stay focused.

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `manifest.config.ts`, `index.html`, `src/main.tsx`, `src/styles/global.css`, `test/setup.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "speeddial",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "preact": "^10.24.0",
    "sortablejs": "^1.15.3",
    "fflate": "^0.8.2"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0-beta.28",
    "@preact/preset-vite": "^2.9.1",
    "@testing-library/preact": "^3.2.4",
    "@types/chrome": "^0.0.270",
    "@types/sortablejs": "^1.15.8",
    "jsdom": "^25.0.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["chrome", "vitest/globals"],
    "paths": { "react": ["./node_modules/preact/compat"], "react-dom": ["./node_modules/preact/compat"] }
  },
  "include": ["src", "test", "manifest.config.ts", "vite.config.ts"]
}
```

- [ ] **Step 3: Create `manifest.config.ts`**

```ts
import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'SpeedDial',
  version: '0.1.0',
  description: 'Free, private, beautiful speed dial new tab.',
  minimum_chrome_version: '110',
  permissions: ['storage', 'unlimitedStorage', 'favicon'],
  chrome_url_overrides: { newtab: 'index.html' },
  // Default MV3 CSP is used (script-src 'self'); do not relax it.
});
```

- [ ] **Step 4: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [preact(), crx({ manifest })],
  build: { target: 'es2022' },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
} as never);
```

- [ ] **Step 5: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Tab</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `src/styles/global.css`**

```css
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  background: var(--bg, #f4f5f7);
  color: var(--fg, #1a1a1a);
}
#app { min-height: 100vh; }
```

- [ ] **Step 7: Create `src/main.tsx`**

```tsx
import { render } from 'preact';
import './styles/global.css';
import { NewTab } from './components/NewTab';

render(<NewTab />, document.getElementById('app')!);
```

- [ ] **Step 8: Create `test/setup.ts` (chrome.* mock)**

```ts
import { vi, beforeEach } from 'vitest';

function createArea() {
  let store: Record<string, unknown> = {};
  return {
    _reset: () => { store = {}; },
    _raw: () => store,
    get: vi.fn(async (keys?: unknown) => {
      if (keys == null) return { ...store };
      if (typeof keys === 'string') return { [keys]: store[keys] };
      if (Array.isArray(keys)) return Object.fromEntries(keys.map((k) => [k, store[k as string]]));
      const defaults = keys as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(defaults)) out[k] = k in store ? store[k] : defaults[k];
      return out;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => { Object.assign(store, items); }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
    }),
    clear: vi.fn(async () => { store = {}; }),
  };
}

const sync = createArea();
const local = createArea();

(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: { sync, local, onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
  runtime: { getURL: (p: string) => 'chrome-extension://test' + p },
};

// Exposed so individual tests can simulate quota failures, e.g. sync.set.mockRejectedValueOnce(...)
export const mockChrome = { sync, local };

beforeEach(() => { sync._reset(); local._reset(); vi.clearAllMocks(); });
```

- [ ] **Step 9: Install dependencies and verify dev tooling**

Run: `npm install`
Expected: completes without errors; `node_modules/` created.

- [ ] **Step 10: Commit**

```bash
git add package.json tsconfig.json vite.config.ts manifest.config.ts index.html src/main.tsx src/styles/global.css test/setup.ts package-lock.json
git commit -m "chore: scaffold Preact + Vite + crxjs MV3 project"
```

> NOTE: `src/main.tsx` imports `NewTab`, created in Task 12. `npm run build` will fail until then; `npm test` works now. This is expected for incremental TDD.

---

## Task 2: Shared types, defaults, and color helper

**Files:**
- Create: `src/lib/types.ts`, `src/lib/defaults.ts`, `src/lib/color.ts`
- Test: `test/color.test.ts`

- [ ] **Step 1: Create `src/lib/types.ts`**

```ts
export const SCHEMA_VERSION = 1;

export type ImageRef = 'favicon' | 'letter' | string; // any other string = key into local.images
export type SearchEngine = 'google' | 'duckduckgo' | 'bing';
export type CardSize = 'sm' | 'md' | 'lg';

export interface Dial {
  id: string;
  url: string;
  title: string;
  imageRef: ImageRef;
  color: string; // used for the 'letter' preview mode
  order: number;
}

export interface Theme {
  id: string;
  name: string;
  builtin: boolean;
  vars: Record<string, string>; // CSS custom property name -> value
}

export interface Background {
  type: 'theme' | 'color' | 'gradient' | 'imageRef';
  value: string; // color/gradient string, or an image key in local.images, or '' for theme default
}

export interface Settings {
  schemaVersion: number;
  activeThemeId: string;
  customThemes: Theme[];
  searchEngine: SearchEngine;
  cardSize: CardSize;
  showClock: boolean;
  greetingName: string | null;
  background: Background;
  useScreenshots: boolean;       // off by default; sends URLs to a 3rd party when on
  screenshotTemplate: string;    // e.g. "https://service.example/{url}"
}

export interface StoredImage {
  data: string;                  // data URL
  source: 'upload' | 'url' | 'screenshot';
  srcUrl?: string;               // original URL for 'url'/'screenshot' sources
}

export interface Snapshot {
  schemaVersion: number;
  settings: Settings;
  dials: Dial[];
  images: Record<string, StoredImage>;
}
```

- [ ] **Step 2: Create `src/lib/defaults.ts` (built-in themes + default settings)**

```ts
import { Settings, Theme, SCHEMA_VERSION } from './types';

export const BUILTIN_THEMES: Theme[] = [
  {
    id: 'light-minimal', name: 'Light Minimal', builtin: true,
    vars: {
      '--bg': '#f4f5f7', '--fg': '#1a1a1a', '--card-bg': '#ffffff',
      '--card-fg': '#1a1a1a', '--accent': '#4285f4', '--muted': '#8a8f98',
      '--radius': '14px', '--card-shadow': '0 2px 10px rgba(0,0,0,.08)',
      '--card-blur': 'none', '--card-border': '1px solid transparent',
      '--search-bg': '#ffffff',
    },
  },
  {
    id: 'glass-gradient', name: 'Glass Gradient', builtin: true,
    vars: {
      '--bg': 'linear-gradient(135deg,#6a5acd 0%,#ec4899 55%,#f59e0b 100%)',
      '--fg': '#ffffff', '--card-bg': 'rgba(255,255,255,.16)',
      '--card-fg': '#ffffff', '--accent': '#ffffff', '--muted': 'rgba(255,255,255,.7)',
      '--radius': '16px', '--card-shadow': '0 4px 20px rgba(0,0,0,.15)',
      '--card-blur': 'blur(8px)', '--card-border': '1px solid rgba(255,255,255,.28)',
      '--search-bg': 'rgba(255,255,255,.18)',
    },
  },
  {
    id: 'dark-neon', name: 'Dark Neon', builtin: true,
    vars: {
      '--bg': '#0d1117', '--fg': '#e6edf3', '--card-bg': '#161b22',
      '--card-fg': '#ffffff', '--accent': '#58a6ff', '--muted': '#7d8590',
      '--radius': '14px', '--card-shadow': '0 2px 14px rgba(0,0,0,.5)',
      '--card-blur': 'none', '--card-border': '1px solid #30363d',
      '--search-bg': '#161b22',
    },
  },
];

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: SCHEMA_VERSION,
  activeThemeId: 'light-minimal',
  customThemes: [],
  searchEngine: 'google',
  cardSize: 'md',
  showClock: true,
  greetingName: null,
  background: { type: 'theme', value: '' },
  useScreenshots: false,
  screenshotTemplate: '',
};
```

- [ ] **Step 3: Write the failing test `test/color.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { colorForKey, initialFor } from '../src/lib/color';

describe('color helper', () => {
  it('returns a stable hex color for the same input', () => {
    expect(colorForKey('https://github.com')).toBe(colorForKey('https://github.com'));
  });
  it('returns a 7-char hex string', () => {
    expect(colorForKey('x')).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('derives an uppercase initial from a title', () => {
    expect(initialFor('github', 'https://github.com')).toBe('G');
  });
  it('falls back to the url hostname when title is empty', () => {
    expect(initialFor('', 'https://duckduckgo.com')).toBe('D');
  });
  it('returns "?" when nothing usable is present', () => {
    expect(initialFor('', '')).toBe('?');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run test/color.test.ts`
Expected: FAIL — cannot resolve `../src/lib/color`.

- [ ] **Step 5: Create `src/lib/color.ts`**

```ts
const PALETTE = [
  '#4285f4', '#ea4335', '#34a853', '#fbbc05', '#7c4dff',
  '#e91e63', '#00bcd4', '#ff7043', '#26a69a', '#5c6bc0',
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function colorForKey(key: string): string {
  return PALETTE[hash(key) % PALETTE.length];
}

export function initialFor(title: string, url: string): string {
  const t = title.trim();
  if (t) return t[0].toUpperCase();
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host) return host[0].toUpperCase();
  } catch { /* not a valid URL */ }
  return '?';
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run test/color.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/defaults.ts src/lib/color.ts test/color.test.ts
git commit -m "feat: add shared types, default themes/settings, and color helper"
```

---

## Task 3: storage.ts (sync/local split + quota fallback)

**Files:**
- Create: `src/lib/storage.ts`
- Test: `test/storage.test.ts`

- [ ] **Step 1: Write the failing test `test/storage.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { mockChrome } from './setup';
import * as storage from '../src/lib/storage';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';
import { Dial } from '../src/lib/types';

const dial = (id: string, order: number): Dial => ({
  id, url: `https://${id}.com`, title: id, imageRef: 'favicon', color: '#000', order,
});

describe('storage', () => {
  it('returns default settings when nothing is stored', async () => {
    expect(await storage.getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips settings through sync', async () => {
    await storage.setSettings({ ...DEFAULT_SETTINGS, greetingName: 'Alex' });
    expect((await storage.getSettings()).greetingName).toBe('Alex');
  });

  it('returns [] for dials when nothing is stored', async () => {
    expect(await storage.getDials()).toEqual([]);
  });

  it('round-trips dials through sync', async () => {
    await storage.setDials([dial('a', 0), dial('b', 1)]);
    const got = await storage.getDials();
    expect(got.map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('stores and reads images from local', async () => {
    await storage.setImage('img1', { data: 'data:x', source: 'upload' });
    expect((await storage.getImage('img1'))?.data).toBe('data:x');
    expect(await storage.getImage('missing')).toBeNull();
  });

  it('deletes images from local', async () => {
    await storage.setImage('img1', { data: 'data:x', source: 'upload' });
    await storage.deleteImage('img1');
    expect(await storage.getImage('img1')).toBeNull();
  });

  it('falls back to local when sync.set rejects (quota)', async () => {
    mockChrome.sync.set.mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'));
    await storage.setDials([dial('a', 0)]);
    // written to local fallback, still readable via getDials
    expect((await storage.getDials()).map((d) => d.id)).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/storage.test.ts`
Expected: FAIL — cannot resolve `../src/lib/storage`.

- [ ] **Step 3: Create `src/lib/storage.ts`**

```ts
import { Settings, Dial, StoredImage } from './types';
import { DEFAULT_SETTINGS } from './defaults';

const K_SETTINGS = 'settings';
const K_DIALS = 'dials';
const IMG_PREFIX = 'img:';

// Write to sync; if the sync quota is exceeded, transparently fall back to local.
async function setSynced(key: string, value: unknown): Promise<void> {
  try {
    await chrome.storage.sync.set({ [key]: value });
    await chrome.storage.local.remove(key); // clear any stale fallback copy
  } catch {
    await chrome.storage.local.set({ [key]: value });
  }
}

// Read from sync first, then the local fallback, then the provided default.
async function getSynced<T>(key: string, fallback: T): Promise<T> {
  const s = await chrome.storage.sync.get(key);
  if (s[key] !== undefined) return s[key] as T;
  const l = await chrome.storage.local.get(key);
  if (l[key] !== undefined) return l[key] as T;
  return fallback;
}

export async function getSettings(): Promise<Settings> {
  const stored = await getSynced<Partial<Settings> | undefined>(K_SETTINGS, undefined);
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

export async function setSettings(settings: Settings): Promise<void> {
  await setSynced(K_SETTINGS, settings);
}

export async function getDials(): Promise<Dial[]> {
  const dials = await getSynced<Dial[]>(K_DIALS, []);
  return [...dials].sort((a, b) => a.order - b.order);
}

export async function setDials(dials: Dial[]): Promise<void> {
  await setSynced(K_DIALS, dials);
}

export async function getImage(ref: string): Promise<StoredImage | null> {
  const res = await chrome.storage.local.get(IMG_PREFIX + ref);
  return (res[IMG_PREFIX + ref] as StoredImage) ?? null;
}

export async function setImage(ref: string, image: StoredImage): Promise<void> {
  await chrome.storage.local.set({ [IMG_PREFIX + ref]: image });
}

export async function deleteImage(ref: string): Promise<void> {
  await chrome.storage.local.remove(IMG_PREFIX + ref);
}

export async function getAllImages(): Promise<Record<string, StoredImage>> {
  const all = await chrome.storage.local.get(null);
  const out: Record<string, StoredImage> = {};
  for (const [k, v] of Object.entries(all)) {
    if (k.startsWith(IMG_PREFIX)) out[k.slice(IMG_PREFIX.length)] = v as StoredImage;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/storage.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts test/storage.test.ts
git commit -m "feat: add storage module with sync/local split and quota fallback"
```

---

## Task 4: themes.ts (resolve + apply CSS variables)

**Files:**
- Create: `src/lib/themes.ts`
- Test: `test/themes.test.ts`

- [ ] **Step 1: Write the failing test `test/themes.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { resolveTheme, applyTheme, allThemes } from '../src/lib/themes';
import { DEFAULT_SETTINGS, BUILTIN_THEMES } from '../src/lib/defaults';
import { Theme } from '../src/lib/types';

const custom: Theme = { id: 'mine', name: 'Mine', builtin: false, vars: { '--bg': '#123456' } };

describe('themes', () => {
  it('lists builtin + custom themes', () => {
    const list = allThemes([custom]);
    expect(list).toHaveLength(BUILTIN_THEMES.length + 1);
    expect(list.find((t) => t.id === 'mine')).toBeDefined();
  });

  it('resolves the active builtin theme', () => {
    const t = resolveTheme({ ...DEFAULT_SETTINGS, activeThemeId: 'dark-neon' });
    expect(t.id).toBe('dark-neon');
  });

  it('resolves a custom theme', () => {
    const t = resolveTheme({ ...DEFAULT_SETTINGS, activeThemeId: 'mine', customThemes: [custom] });
    expect(t.id).toBe('mine');
  });

  it('falls back to the first builtin when active id is unknown', () => {
    const t = resolveTheme({ ...DEFAULT_SETTINGS, activeThemeId: 'nope' });
    expect(t.id).toBe(BUILTIN_THEMES[0].id);
  });

  it('applies theme vars to a target element', () => {
    const el = document.createElement('div');
    applyTheme({ ...DEFAULT_SETTINGS, activeThemeId: 'dark-neon' }, el);
    expect(el.style.getPropertyValue('--bg')).toBe('#0d1117');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/themes.test.ts`
Expected: FAIL — cannot resolve `../src/lib/themes`.

- [ ] **Step 3: Create `src/lib/themes.ts`**

```ts
import { Settings, Theme } from './types';
import { BUILTIN_THEMES } from './defaults';

export function allThemes(custom: Theme[]): Theme[] {
  return [...BUILTIN_THEMES, ...custom];
}

export function resolveTheme(settings: Settings): Theme {
  const list = allThemes(settings.customThemes);
  return list.find((t) => t.id === settings.activeThemeId) ?? BUILTIN_THEMES[0];
}

// Applies the active theme's CSS variables, then overrides --bg if a custom background is set.
export function applyTheme(settings: Settings, target: HTMLElement = document.documentElement): void {
  const theme = resolveTheme(settings);
  for (const [name, value] of Object.entries(theme.vars)) {
    target.style.setProperty(name, value);
  }
  const bg = settings.background;
  if (bg.type === 'color' || bg.type === 'gradient') {
    target.style.setProperty('--bg', bg.value);
  }
  // bg.type === 'imageRef' is applied by the component (needs the resolved data URL).
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/themes.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/themes.ts test/themes.test.ts
git commit -m "feat: add theme resolution and CSS-variable application"
```

---

## Task 5: images.ts (preview cascade + URL cache)

**Files:**
- Create: `src/lib/images.ts`
- Test: `test/images.test.ts`

- [ ] **Step 1: Write the failing test `test/images.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as storage from '../src/lib/storage';
import { faviconUrl, resolvePreview, cacheImageFromUrl, fileToDataUrl } from '../src/lib/images';
import { Dial, Settings } from '../src/lib/types';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';

const dial = (over: Partial<Dial> = {}): Dial => ({
  id: 'a', url: 'https://github.com', title: 'GitHub', imageRef: 'favicon', color: '#000', order: 0, ...over,
});
const settings: Settings = { ...DEFAULT_SETTINGS };

beforeEach(() => { vi.restoreAllMocks(); });

describe('images', () => {
  it('builds an MV3 favicon URL', () => {
    const u = faviconUrl('https://github.com', 64);
    expect(u).toContain('/_favicon/');
    expect(u).toContain('pageUrl=');
    expect(u).toContain('size=64');
  });

  it('resolves a stored image into a data URL', async () => {
    await storage.setImage('a', { data: 'data:img', source: 'upload' });
    const r = await resolvePreview(dial({ imageRef: 'a' }), settings);
    expect(r).toEqual({ kind: 'image', src: 'data:img' });
  });

  it('resolves favicon mode to a favicon URL', async () => {
    const r = await resolvePreview(dial({ imageRef: 'favicon' }), settings);
    expect(r.kind).toBe('favicon');
  });

  it('resolves letter mode to an initial + color', async () => {
    const r = await resolvePreview(dial({ imageRef: 'letter', title: 'GitHub' }), settings);
    expect(r).toEqual({ kind: 'letter', letter: 'G', color: '#000' });
  });

  it('resolves screenshot mode when enabled', async () => {
    const r = await resolvePreview(
      dial({ imageRef: 'favicon', url: 'https://x.com' }),
      { ...settings, useScreenshots: true, screenshotTemplate: 'https://shot/{url}' },
    );
    // favicon mode still wins unless the card opts into screenshot via imageRef='screenshot'
    expect(r.kind).toBe('favicon');
    const r2 = await resolvePreview(
      dial({ imageRef: 'screenshot', url: 'https://x.com' }),
      { ...settings, useScreenshots: true, screenshotTemplate: 'https://shot/{url}' },
    );
    expect(r2).toEqual({ kind: 'image', src: 'https://shot/https%3A%2F%2Fx.com' });
  });

  it('caches a fetched URL image into local storage', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => blob })));
    vi.spyOn(globalThis, 'FileReader').mockImplementation(function (this: any) {
      this.readAsDataURL = () => { this.result = 'data:cached'; this.onload?.(); };
    } as never);
    const ref = await cacheImageFromUrl('https://img/p.png');
    expect((await storage.getImage(ref))?.data).toBe('data:cached');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/images.test.ts`
Expected: FAIL — cannot resolve `../src/lib/images`.

- [ ] **Step 3: Create `src/lib/images.ts`**

```ts
import { Dial, Settings, StoredImage } from './types';
import { getImage, setImage } from './storage';
import { colorForKey, initialFor } from './color';

export type Preview =
  | { kind: 'image'; src: string }
  | { kind: 'favicon'; src: string }
  | { kind: 'letter'; letter: string; color: string };

export function faviconUrl(pageUrl: string, size = 64): string {
  const base = chrome.runtime.getURL('/_favicon/');
  return `${base}?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`;
}

// Reads a File into a data URL (used by the upload flow in CardEditor).
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Fetches a remote image, stores it as a data URL in local, and returns its imageRef key.
export async function cacheImageFromUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const blob = await res.blob();
  const data: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const ref = 'url-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const stored: StoredImage = { data, source: 'url', srcUrl: url };
  await setImage(ref, stored);
  return ref;
}

// Decides what to render for a card's preview. Cascade: stored image -> screenshot ->
// favicon -> letter+color. The component handles runtime <img> errors by re-requesting
// the next tier (favicon, then letter).
export async function resolvePreview(dial: Dial, settings: Settings): Promise<Preview> {
  if (dial.imageRef === 'letter') {
    return { kind: 'letter', letter: initialFor(dial.title, dial.url), color: dial.color || colorForKey(dial.url) };
  }
  if (dial.imageRef === 'screenshot') {
    if (settings.useScreenshots && settings.screenshotTemplate) {
      return { kind: 'image', src: settings.screenshotTemplate.replace('{url}', encodeURIComponent(dial.url)) };
    }
    return { kind: 'favicon', src: faviconUrl(dial.url) };
  }
  if (dial.imageRef !== 'favicon') {
    const img = await getImage(dial.imageRef);
    if (img) return { kind: 'image', src: img.data };
  }
  return { kind: 'favicon', src: faviconUrl(dial.url) };
}

export function letterFallback(dial: Dial): Preview {
  return { kind: 'letter', letter: initialFor(dial.title, dial.url), color: dial.color || colorForKey(dial.url) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/images.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/images.ts test/images.test.ts
git commit -m "feat: add image preview cascade and URL caching"
```

---

## Task 6: backup.ts (snapshot + JSON/ZIP export/import)

**Files:**
- Create: `src/lib/backup.ts`
- Test: `test/backup.test.ts`

- [ ] **Step 1: Write the failing test `test/backup.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import * as storage from '../src/lib/storage';
import { buildSnapshot, serialize, parseSnapshot, restoreSnapshot } from '../src/lib/backup';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';
import { Dial } from '../src/lib/types';

const dial: Dial = { id: 'a', url: 'https://a.com', title: 'A', imageRef: 'img1', color: '#000', order: 0 };

describe('backup', () => {
  it('builds a snapshot from current storage', async () => {
    await storage.setSettings({ ...DEFAULT_SETTINGS, greetingName: 'Alex' });
    await storage.setDials([dial]);
    await storage.setImage('img1', { data: 'data:x', source: 'upload' });
    const snap = await buildSnapshot();
    expect(snap.settings.greetingName).toBe('Alex');
    expect(snap.dials).toHaveLength(1);
    expect(snap.images.img1.data).toBe('data:x');
  });

  it('serializes to JSON when there are no images', async () => {
    await storage.setDials([{ ...dial, imageRef: 'favicon' }]);
    const out = await serialize(await buildSnapshot());
    expect(out.kind).toBe('json');
    expect(out.filename).toMatch(/\.json$/);
  });

  it('serializes to ZIP when images are present', async () => {
    await storage.setDials([dial]);
    await storage.setImage('img1', { data: 'data:image/png;base64,AAAA', source: 'upload' });
    const out = await serialize(await buildSnapshot());
    expect(out.kind).toBe('zip');
    expect(out.filename).toMatch(/\.zip$/);
    expect(out.blob.size).toBeGreaterThan(0);
  });

  it('round-trips a JSON snapshot', async () => {
    const snap = { schemaVersion: 1, settings: DEFAULT_SETTINGS, dials: [{ ...dial, imageRef: 'favicon' }], images: {} };
    const parsed = await parseSnapshot(new Blob([JSON.stringify(snap)], { type: 'application/json' }), 'b.json');
    expect(parsed.dials[0].id).toBe('a');
  });

  it('rejects an unknown schema version', async () => {
    const bad = new Blob([JSON.stringify({ schemaVersion: 999, settings: {}, dials: [], images: {} })]);
    await expect(parseSnapshot(bad, 'b.json')).rejects.toThrow(/version/i);
  });

  it('restores a snapshot into storage', async () => {
    const snap = { schemaVersion: 1, settings: { ...DEFAULT_SETTINGS, greetingName: 'Z' }, dials: [{ ...dial, imageRef: 'favicon' }], images: {} };
    await restoreSnapshot(snap);
    expect((await storage.getSettings()).greetingName).toBe('Z');
    expect((await storage.getDials())[0].id).toBe('a');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/backup.test.ts`
Expected: FAIL — cannot resolve `../src/lib/backup`.

- [ ] **Step 3: Create `src/lib/backup.ts`**

```ts
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { Snapshot, SCHEMA_VERSION } from './types';
import * as storage from './storage';
import { DEFAULT_SETTINGS } from './defaults';

export interface SerializedBackup {
  kind: 'json' | 'zip';
  filename: string;
  blob: Blob;
}

export async function buildSnapshot(): Promise<Snapshot> {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: await storage.getSettings(),
    dials: await storage.getDials(),
    images: await storage.getAllImages(),
  };
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function serialize(snap: Snapshot): Promise<SerializedBackup> {
  const hasImages = Object.keys(snap.images).length > 0;
  if (!hasImages) {
    return {
      kind: 'json',
      filename: `speeddial-backup-${dateStamp()}.json`,
      blob: new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' }),
    };
  }
  // ZIP: settings.json (metadata, no image data) + images/<ref>.txt (each data URL)
  const files: Record<string, Uint8Array> = {};
  const meta = { schemaVersion: snap.schemaVersion, settings: snap.settings, dials: snap.dials };
  files['settings.json'] = strToU8(JSON.stringify(meta, null, 2));
  for (const [ref, img] of Object.entries(snap.images)) {
    files[`images/${ref}.json`] = strToU8(JSON.stringify(img));
  }
  const zipped = zipSync(files, { level: 6 });
  return {
    kind: 'zip',
    filename: `speeddial-backup-${dateStamp()}.zip`,
    blob: new Blob([zipped], { type: 'application/zip' }),
  };
}

function validate(snap: Snapshot): void {
  if (snap.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported backup version ${snap.schemaVersion}; this build expects ${SCHEMA_VERSION}.`);
  }
  if (!Array.isArray(snap.dials)) throw new Error('Invalid backup: missing dials.');
}

export async function parseSnapshot(blob: Blob, filename: string): Promise<Snapshot> {
  let snap: Snapshot;
  if (filename.toLowerCase().endsWith('.zip')) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    const files = unzipSync(buf);
    const meta = JSON.parse(strFromU8(files['settings.json']));
    const images: Snapshot['images'] = {};
    for (const [path, bytes] of Object.entries(files)) {
      if (path.startsWith('images/') && path.endsWith('.json')) {
        const ref = path.slice('images/'.length, -'.json'.length);
        images[ref] = JSON.parse(strFromU8(bytes));
      }
    }
    snap = { schemaVersion: meta.schemaVersion, settings: meta.settings, dials: meta.dials, images };
  } else {
    snap = JSON.parse(await blob.text());
  }
  validate(snap);
  return snap;
}

export async function restoreSnapshot(snap: Snapshot): Promise<void> {
  validate(snap);
  await storage.setSettings({ ...DEFAULT_SETTINGS, ...snap.settings });
  await storage.setDials(snap.dials);
  for (const [ref, img] of Object.entries(snap.images)) {
    await storage.setImage(ref, img);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/backup.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/backup.ts test/backup.test.ts
git commit -m "feat: add backup snapshot with JSON/ZIP export and import"
```

---

## Task 7: AppState context (state + actions)

**Files:**
- Create: `src/state/AppState.tsx`
- Test: `test/appstate.test.tsx`

- [ ] **Step 1: Write the failing test `test/appstate.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { AppProvider, useApp } from '../src/state/AppState';

function Probe() {
  const { dials, addDial, ready } = useApp();
  if (!ready) return <span>loading</span>;
  return (
    <div>
      <span data-testid="count">{dials.length}</span>
      <button onClick={() => addDial({ url: 'https://x.com', title: 'X' })}>add</button>
    </div>
  );
}

describe('AppState', () => {
  it('loads and exposes empty dials initially', async () => {
    render(<AppProvider><Probe /></AppProvider>);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
  });

  it('adds a dial and updates count', async () => {
    render(<AppProvider><Probe /></AppProvider>);
    await waitFor(() => screen.getByText('add'));
    fireEvent.click(screen.getByText('add'));
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/appstate.test.tsx`
Expected: FAIL — cannot resolve `../src/state/AppState`.

- [ ] **Step 3: Create `src/state/AppState.tsx`**

```tsx
import { createContext } from 'preact';
import { useContext, useEffect, useState, useCallback } from 'preact/hooks';
import { ComponentChildren } from 'preact';
import { Dial, Settings } from '../lib/types';
import * as storage from '../lib/storage';
import { DEFAULT_SETTINGS } from '../lib/defaults';

interface AppContextValue {
  ready: boolean;
  dials: Dial[];
  settings: Settings;
  addDial: (input: { url: string; title: string }) => Promise<void>;
  updateDial: (dial: Dial) => Promise<void>;
  removeDial: (id: string) => Promise<void>;
  reorderDials: (orderedIds: string[]) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  reload: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function uid(): string {
  return 'd-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function AppProvider({ children }: { children: ComponentChildren }) {
  const [ready, setReady] = useState(false);
  const [dials, setDials] = useState<Dial[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const reload = useCallback(async () => {
    setDials(await storage.getDials());
    setSettings(await storage.getSettings());
    setReady(true);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const persistDials = useCallback(async (next: Dial[]) => {
    setDials(next);
    await storage.setDials(next);
  }, []);

  const addDial = useCallback(async (input: { url: string; title: string }) => {
    const next = [
      ...dials,
      { id: uid(), url: input.url, title: input.title, imageRef: 'favicon' as const, color: '', order: dials.length },
    ];
    await persistDials(next);
  }, [dials, persistDials]);

  const updateDial = useCallback(async (dial: Dial) => {
    await persistDials(dials.map((d) => (d.id === dial.id ? dial : d)));
  }, [dials, persistDials]);

  const removeDial = useCallback(async (id: string) => {
    await persistDials(dials.filter((d) => d.id !== id).map((d, i) => ({ ...d, order: i })));
  }, [dials, persistDials]);

  const reorderDials = useCallback(async (orderedIds: string[]) => {
    const byId = new Map(dials.map((d) => [d.id, d]));
    const next = orderedIds.map((id, i) => ({ ...byId.get(id)!, order: i }));
    await persistDials(next);
  }, [dials, persistDials]);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await storage.setSettings(next);
  }, [settings]);

  const value: AppContextValue = {
    ready, dials, settings, addDial, updateDial, removeDial, reorderDials, updateSettings, reload,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/appstate.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/state/AppState.tsx test/appstate.test.tsx
git commit -m "feat: add AppState context with dial and settings actions"
```

---

## Task 8: DialCard component

**Files:**
- Create: `src/components/DialCard.tsx`
- Test: `test/dialcard.test.tsx`

- [ ] **Step 1: Write the failing test `test/dialcard.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { DialCard } from '../src/components/DialCard';
import { Dial } from '../src/lib/types';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';

const dial: Dial = { id: 'a', url: 'https://github.com', title: 'GitHub', imageRef: 'letter', color: '#123456', order: 0 };

describe('DialCard', () => {
  it('renders the title', async () => {
    render(<DialCard dial={dial} settings={DEFAULT_SETTINGS} onEdit={() => {}} onDelete={() => {}} />);
    await waitFor(() => expect(screen.getByText('GitHub')).toBeTruthy());
  });

  it('renders a letter preview for letter mode', async () => {
    render(<DialCard dial={dial} settings={DEFAULT_SETTINGS} onEdit={() => {}} onDelete={() => {}} />);
    await waitFor(() => expect(screen.getByText('G')).toBeTruthy());
  });

  it('calls onEdit when the edit action is triggered', async () => {
    const onEdit = vi.fn();
    render(<DialCard dial={dial} settings={DEFAULT_SETTINGS} onEdit={onEdit} onDelete={() => {}} />);
    await waitFor(() => screen.getByLabelText('Edit GitHub'));
    fireEvent.click(screen.getByLabelText('Edit GitHub'));
    expect(onEdit).toHaveBeenCalledWith(dial);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/dialcard.test.tsx`
Expected: FAIL — cannot resolve `../src/components/DialCard`.

- [ ] **Step 3: Create `src/components/DialCard.tsx`**

```tsx
import { useEffect, useState } from 'preact/hooks';
import { Dial, Settings } from '../lib/types';
import { Preview, resolvePreview, letterFallback } from '../lib/images';

interface Props {
  dial: Dial;
  settings: Settings;
  onEdit: (dial: Dial) => void;
  onDelete: (id: string) => void;
}

export function DialCard({ dial, settings, onEdit, onDelete }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    let alive = true;
    void resolvePreview(dial, settings).then((p) => { if (alive) setPreview(p); });
    return () => { alive = false; };
  }, [dial, settings]);

  // If a remote/favicon image fails at runtime, fall back to the letter tile.
  const onImgError = () => setPreview(letterFallback(dial));

  return (
    <div class="dial-card" data-id={dial.id}>
      <a class="dial-link" href={dial.url}>
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
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/dialcard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Append card styles to `src/styles/global.css`**

```css
.dial-grid { display: grid; gap: 16px; padding: 24px; max-width: 920px; margin: 0 auto;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); }
.dial-grid[data-size="sm"] { grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); }
.dial-grid[data-size="lg"] { grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); }
.dial-card { position: relative; }
.dial-link { display: flex; flex-direction: column; align-items: center; gap: 8px;
  text-decoration: none; color: var(--fg); }
.dial-thumb { width: 100%; aspect-ratio: 1; border-radius: var(--radius); overflow: hidden;
  background: var(--card-bg); box-shadow: var(--card-shadow); border: var(--card-border);
  backdrop-filter: var(--card-blur); display: flex; align-items: center; justify-content: center; }
.dial-thumb img { width: 100%; height: 100%; object-fit: cover; }
.dial-thumb img.dial-favicon { width: 48%; height: 48%; object-fit: contain; }
.dial-letter { font-size: 32px; font-weight: 700; color: #fff; width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center; }
.dial-title { font-size: 13px; text-align: center; max-width: 100%; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; }
.dial-actions { position: absolute; top: 4px; right: 4px; display: none; gap: 2px; }
.dial-card:hover .dial-actions { display: flex; }
.dial-actions button { border: none; border-radius: 8px; cursor: pointer;
  background: rgba(0,0,0,.45); color: #fff; width: 22px; height: 22px; font-size: 11px; }
.sortable-ghost { opacity: .4; }
```

- [ ] **Step 6: Commit**

```bash
git add src/components/DialCard.tsx test/dialcard.test.tsx src/styles/global.css
git commit -m "feat: add DialCard with preview cascade and hover actions"
```

---

## Task 9: DialGrid with SortableJS drag-and-drop

**Files:**
- Create: `src/components/DialGrid.tsx`
- Test: `test/dialgrid.test.tsx`

- [ ] **Step 1: Write the failing test `test/dialgrid.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import { DialGrid } from '../src/components/DialGrid';
import { Dial } from '../src/lib/types';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';

vi.mock('sortablejs', () => ({ default: { create: vi.fn(() => ({ destroy: vi.fn() })) } }));

const dials: Dial[] = [
  { id: 'a', url: 'https://a.com', title: 'A', imageRef: 'letter', color: '#111', order: 0 },
  { id: 'b', url: 'https://b.com', title: 'B', imageRef: 'letter', color: '#222', order: 1 },
];

describe('DialGrid', () => {
  it('renders one card per dial', async () => {
    render(<DialGrid dials={dials} settings={DEFAULT_SETTINGS} onEdit={() => {}} onDelete={() => {}} onReorder={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('A')).toBeTruthy();
      expect(screen.getByText('B')).toBeTruthy();
    });
  });

  it('applies the card-size data attribute', async () => {
    const { container } = render(
      <DialGrid dials={dials} settings={{ ...DEFAULT_SETTINGS, cardSize: 'lg' }} onEdit={() => {}} onDelete={() => {}} onReorder={() => {}} />,
    );
    expect(container.querySelector('.dial-grid')?.getAttribute('data-size')).toBe('lg');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/dialgrid.test.tsx`
Expected: FAIL — cannot resolve `../src/components/DialGrid`.

- [ ] **Step 3: Create `src/components/DialGrid.tsx`**

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
}

export function DialGrid({ dials, settings, onEdit, onDelete, onReorder }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
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
  }, [onReorder]);

  return (
    <div class="dial-grid" data-size={settings.cardSize} ref={ref}>
      {dials.map((dial) => (
        <DialCard key={dial.id} dial={dial} settings={settings} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/dialgrid.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/DialGrid.tsx test/dialgrid.test.tsx
git commit -m "feat: add DialGrid with SortableJS drag-and-drop reorder"
```

---

## Task 10: CardEditor modal

**Files:**
- Create: `src/components/CardEditor.tsx`
- Test: `test/cardeditor.test.tsx`

- [ ] **Step 1: Write the failing test `test/cardeditor.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { CardEditor } from '../src/components/CardEditor';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';

describe('CardEditor', () => {
  it('disables save when URL is empty', () => {
    render(<CardEditor settings={DEFAULT_SETTINGS} onSave={() => {}} onClose={() => {}} />);
    expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('saves url + title + imageRef for a new card', () => {
    const onSave = vi.fn();
    render(<CardEditor settings={DEFAULT_SETTINGS} onSave={onSave} onClose={() => {}} />);
    fireEvent.input(screen.getByLabelText('URL'), { target: { value: 'https://x.com' } });
    fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'X' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://x.com', title: 'X', imageRef: 'favicon' }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/cardeditor.test.tsx`
Expected: FAIL — cannot resolve `../src/components/CardEditor`.

- [ ] **Step 3: Create `src/components/CardEditor.tsx`**

```tsx
import { useState } from 'preact/hooks';
import { Dial, Settings, ImageRef } from '../lib/types';
import { fileToDataUrl, cacheImageFromUrl } from '../lib/images';
import { setImage } from '../lib/storage';
import { colorForKey } from '../lib/color';

interface Props {
  settings: Settings;
  initial?: Dial;
  onSave: (dial: Omit<Dial, 'order'> & { order?: number }) => void;
  onClose: () => void;
}

type Mode = 'favicon' | 'letter' | 'upload' | 'url' | 'screenshot';

function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return v;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export function CardEditor({ settings, initial, onSave, onClose }: Props) {
  const [url, setUrl] = useState(initial?.url ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [mode, setMode] = useState<Mode>(
    initial && !['favicon', 'letter', 'screenshot'].includes(initial.imageRef) ? 'upload' : ((initial?.imageRef as Mode) ?? 'favicon'),
  );
  const [imageUrl, setImageUrl] = useState('');
  const [uploadRef, setUploadRef] = useState<string | null>(
    initial && !['favicon', 'letter', 'screenshot'].includes(initial.imageRef) ? initial.imageRef : null,
  );
  const [busy, setBusy] = useState(false);

  const canSave = url.trim().length > 0 && !busy;

  const onFile = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    setBusy(true);
    const data = await fileToDataUrl(file);
    const ref = 'up-' + Date.now().toString(36);
    await setImage(ref, { data, source: 'upload' });
    setUploadRef(ref);
    setBusy(false);
  };

  const resolveImageRef = async (finalUrl: string): Promise<ImageRef> => {
    if (mode === 'favicon' || mode === 'letter' || mode === 'screenshot') return mode;
    if (mode === 'upload') return uploadRef ?? 'favicon';
    // mode === 'url'
    if (imageUrl.trim()) return await cacheImageFromUrl(imageUrl.trim());
    return 'favicon';
  };

  const save = async () => {
    setBusy(true);
    const finalUrl = normalizeUrl(url);
    const finalTitle = title.trim() || finalUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const imageRef = await resolveImageRef(finalUrl);
    onSave({
      id: initial?.id ?? '',
      url: finalUrl,
      title: finalTitle,
      imageRef,
      color: initial?.color || colorForKey(finalUrl),
      order: initial?.order,
    });
    setBusy(false);
  };

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{initial ? 'Edit card' : 'Add card'}</h3>

        <label for="ce-url">URL</label>
        <input id="ce-url" value={url} onInput={(e) => setUrl((e.target as HTMLInputElement).value)} placeholder="https://example.com" />

        <label for="ce-title">Title</label>
        <input id="ce-title" value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} placeholder="Example" />

        <label for="ce-mode">Preview</label>
        <select id="ce-mode" value={mode} onChange={(e) => setMode((e.target as HTMLSelectElement).value as Mode)}>
          <option value="favicon">Site icon</option>
          <option value="letter">Letter + color</option>
          <option value="upload">Upload image</option>
          <option value="url">Image URL</option>
          {settings.useScreenshots && <option value="screenshot">Screenshot</option>}
        </select>

        {mode === 'upload' && <input type="file" accept="image/*" aria-label="Upload image" onChange={onFile} />}
        {mode === 'url' && (
          <input aria-label="Image URL" value={imageUrl} placeholder="https://.../image.png"
            onInput={(e) => setImageUrl((e.target as HTMLInputElement).value)} />
        )}

        <div class="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button disabled={!canSave} onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/cardeditor.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Append modal styles to `src/styles/global.css`**

```css
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.5);
  display: flex; align-items: center; justify-content: center; z-index: 50; }
.modal { background: var(--card-bg, #fff); color: var(--card-fg, #1a1a1a);
  padding: 20px; border-radius: 14px; width: min(420px, 92vw); display: flex; flex-direction: column; gap: 8px; }
.modal h3 { margin: 0 0 8px; }
.modal label { font-size: 12px; opacity: .7; margin-top: 6px; }
.modal input, .modal select { padding: 8px 10px; border-radius: 8px; border: 1px solid var(--muted, #ccc);
  background: var(--search-bg, #fff); color: inherit; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
.modal-actions button { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; }
.modal-actions button:last-child { background: var(--accent, #4285f4); color: #fff; }
.modal-actions button:disabled { opacity: .5; cursor: not-allowed; }
```

- [ ] **Step 6: Commit**

```bash
git add src/components/CardEditor.tsx test/cardeditor.test.tsx src/styles/global.css
git commit -m "feat: add CardEditor modal with image source selection"
```

---

## Task 11: Clock and SearchBar

**Files:**
- Create: `src/components/Clock.tsx`, `src/components/SearchBar.tsx`
- Test: `test/clock.test.tsx`, `test/searchbar.test.tsx`

- [ ] **Step 1: Write the failing test `test/clock.test.tsx`**

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
  beforeEach(() => vi.useFakeTimers().setSystemTime(new Date('2026-05-24T09:00:00')));
  afterEach(() => vi.useRealTimers());
  it('renders a greeting with the name', () => {
    render(<Clock name="Alex" />);
    expect(screen.getByText(/Good morning, Alex/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/clock.test.tsx`
Expected: FAIL — cannot resolve `../src/components/Clock`.

- [ ] **Step 3: Create `src/components/Clock.tsx`**

```tsx
import { useEffect, useState } from 'preact/hooks';

export function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function Clock({ name }: { name: string | null }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing test `test/searchbar.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { searchUrl } from '../src/components/SearchBar';

describe('searchUrl', () => {
  it('builds a Google query URL', () => {
    expect(searchUrl('google', 'cats')).toBe('https://www.google.com/search?q=cats');
  });
  it('builds a DuckDuckGo query URL', () => {
    expect(searchUrl('duckduckgo', 'a b')).toBe('https://duckduckgo.com/?q=a%20b');
  });
  it('builds a Bing query URL', () => {
    expect(searchUrl('bing', 'x')).toBe('https://www.bing.com/search?q=x');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run test/searchbar.test.tsx`
Expected: FAIL — cannot resolve `../src/components/SearchBar`.

- [ ] **Step 7: Create `src/components/SearchBar.tsx`**

```tsx
import { useState } from 'preact/hooks';
import { SearchEngine } from '../lib/types';

const ENGINES: Record<SearchEngine, (q: string) => string> = {
  google: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  duckduckgo: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
  bing: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
};

export function searchUrl(engine: SearchEngine, query: string): string {
  return ENGINES[engine](query);
}

interface Props {
  engine: SearchEngine;
  onFilter: (text: string) => void;
}

export function SearchBar({ engine, onFilter }: Props) {
  const [value, setValue] = useState('');
  const submit = (e: Event) => {
    e.preventDefault();
    if (value.trim()) window.location.href = searchUrl(engine, value.trim());
  };
  return (
    <form class="searchbar" onSubmit={submit}>
      <input
        placeholder="Search the web or filter your cards…"
        value={value}
        onInput={(e) => { const v = (e.target as HTMLInputElement).value; setValue(v); onFilter(v); }}
      />
    </form>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run test/searchbar.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 9: Append header styles to `src/styles/global.css`**

```css
.header { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 48px 16px 8px; }
.clock { text-align: center; }
.clock-time { font-size: 48px; font-weight: 700; letter-spacing: -1px; }
.clock-greeting { font-size: 15px; color: var(--muted); margin-top: 2px; }
.searchbar { width: min(560px, 90vw); }
.searchbar input { width: 100%; height: 44px; padding: 0 18px; border-radius: 22px; font-size: 15px;
  border: var(--card-border); background: var(--search-bg); color: var(--fg); box-shadow: var(--card-shadow);
  backdrop-filter: var(--card-blur); }
```

- [ ] **Step 10: Commit**

```bash
git add src/components/Clock.tsx src/components/SearchBar.tsx test/clock.test.tsx test/searchbar.test.tsx src/styles/global.css
git commit -m "feat: add Clock and SearchBar components"
```

---

## Task 12: Settings, ThemePicker, and NewTab assembly

**Files:**
- Create: `src/components/ThemePicker.tsx`, `src/components/Settings.tsx`, `src/components/NewTab.tsx`
- Test: `test/newtab.test.tsx`

- [ ] **Step 1: Create `src/components/ThemePicker.tsx`**

```tsx
import { allThemes } from '../lib/themes';
import { Settings, Theme } from '../lib/types';

interface Props {
  settings: Settings;
  onPick: (themeId: string) => void;
  onAddCustom: (theme: Theme) => void;
}

export function ThemePicker({ settings, onPick, onAddCustom }: Props) {
  const themes = allThemes(settings.customThemes);
  const cloneActive = () => {
    const base = themes.find((t) => t.id === settings.activeThemeId) ?? themes[0];
    const clone: Theme = {
      id: 'custom-' + Date.now().toString(36),
      name: base.name + ' (copy)',
      builtin: false,
      vars: { ...base.vars },
    };
    onAddCustom(clone);
  };
  return (
    <div class="theme-picker">
      <div class="theme-swatches">
        {themes.map((t) => (
          <button
            key={t.id}
            class={`theme-swatch${t.id === settings.activeThemeId ? ' active' : ''}`}
            style={{ background: t.vars['--bg'] }}
            title={t.name}
            onClick={() => onPick(t.id)}
          >
            <span style={{ color: t.vars['--accent'] }}>{t.name}</span>
          </button>
        ))}
      </div>
      <button class="theme-add" onClick={cloneActive}>+ New theme from current</button>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/Settings.tsx`**

```tsx
import { useState } from 'preact/hooks';
import { Settings as SettingsType, Theme, SearchEngine, CardSize } from '../lib/types';
import { ThemePicker } from './ThemePicker';
import { buildSnapshot, serialize, parseSnapshot, restoreSnapshot } from '../lib/backup';
import { setImage } from '../lib/storage';

interface Props {
  settings: SettingsType;
  onChange: (patch: Partial<SettingsType>) => void;
  onClose: () => void;
  onRestored: () => void;
}

export function Settings({ settings, onChange, onClose, onRestored }: Props) {
  const [importMsg, setImportMsg] = useState('');

  const doExport = async () => {
    const out = await serialize(await buildSnapshot());
    const url = URL.createObjectURL(out.blob);
    const a = document.createElement('a');
    a.href = url; a.download = out.filename; a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const snap = await parseSnapshot(file, file.name);
      const ok = confirm(`Import ${snap.dials.length} cards and ${snap.settings.customThemes.length} custom themes? This replaces your current data.`);
      if (!ok) return;
      await restoreSnapshot(snap);
      onRestored();
      setImportMsg('Imported successfully.');
    } catch (err) {
      setImportMsg(`Import failed: ${(err as Error).message}`);
    }
  };

  const addCustom = (theme: Theme) => onChange({ customThemes: [...settings.customThemes, theme], activeThemeId: theme.id });

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal settings" onClick={(e) => e.stopPropagation()}>
        <h3>Settings</h3>

        <label>Theme</label>
        <ThemePicker settings={settings} onPick={(id) => onChange({ activeThemeId: id })} onAddCustom={addCustom} />

        <label for="se-engine">Search engine</label>
        <select id="se-engine" value={settings.searchEngine}
          onChange={(e) => onChange({ searchEngine: (e.target as HTMLSelectElement).value as SearchEngine })}>
          <option value="google">Google</option>
          <option value="duckduckgo">DuckDuckGo</option>
          <option value="bing">Bing</option>
        </select>

        <label for="se-size">Card size</label>
        <select id="se-size" value={settings.cardSize}
          onChange={(e) => onChange({ cardSize: (e.target as HTMLSelectElement).value as CardSize })}>
          <option value="sm">Small</option>
          <option value="md">Medium</option>
          <option value="lg">Large</option>
        </select>

        <label>
          <input type="checkbox" checked={settings.showClock}
            onChange={(e) => onChange({ showClock: (e.target as HTMLInputElement).checked })} /> Show clock
        </label>

        <label for="se-name">Greeting name</label>
        <input id="se-name" value={settings.greetingName ?? ''}
          onInput={(e) => onChange({ greetingName: (e.target as HTMLInputElement).value || null })} />

        <label>
          <input type="checkbox" checked={settings.useScreenshots}
            onChange={(e) => onChange({ useScreenshots: (e.target as HTMLInputElement).checked })} />
          Use screenshot service for previews
        </label>
        <p class="settings-warn">⚠ When on, the URLs of sites you add are sent to a third-party screenshot service. Off by default.</p>
        {settings.useScreenshots && (
          <input aria-label="Screenshot service template" placeholder="https://service.example/{url}"
            value={settings.screenshotTemplate}
            onInput={(e) => onChange({ screenshotTemplate: (e.target as HTMLInputElement).value })} />
        )}

        <label>Backup</label>
        <div class="settings-backup">
          <button onClick={doExport}>Export</button>
          <label class="import-btn">Import<input type="file" accept=".json,.zip" hidden onChange={doImport} /></label>
        </div>
        {importMsg && <p class="settings-msg">{importMsg}</p>}

        <div class="modal-actions"><button onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/NewTab.tsx`**

```tsx
import { useEffect, useState } from 'preact/hooks';
import { AppProvider, useApp } from '../state/AppState';
import { applyTheme } from '../lib/themes';
import { getImage } from '../lib/storage';
import { Dial } from '../lib/types';
import { Clock } from './Clock';
import { SearchBar } from './SearchBar';
import { DialGrid } from './DialGrid';
import { CardEditor } from './CardEditor';
import { Settings } from './Settings';

function Board() {
  const { ready, dials, settings, addDial, updateDial, removeDial, reorderDials, updateSettings, reload } = useApp();
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<Dial | null | undefined>(undefined); // undefined=closed, null=new
  const [showSettings, setShowSettings] = useState(false);

  // Apply theme + image background whenever settings change.
  useEffect(() => {
    applyTheme(settings);
    const bg = settings.background;
    if (bg.type === 'imageRef' && bg.value) {
      void getImage(bg.value).then((img) => {
        if (img) document.documentElement.style.setProperty('--bg', `center/cover url(${img.data})`);
      });
    }
  }, [settings]);

  if (!ready) return null;

  const visible = filter
    ? dials.filter((d) => (d.title + ' ' + d.url).toLowerCase().includes(filter.toLowerCase()))
    : dials;

  const onSave = async (input: Omit<Dial, 'order'> & { order?: number }) => {
    if (input.id) await updateDial({ ...input, order: input.order ?? 0 } as Dial);
    else await addDial({ url: input.url, title: input.title });
    setEditing(undefined);
  };

  return (
    <div class="board">
      <button class="settings-gear" aria-label="Open settings" onClick={() => setShowSettings(true)}>⚙</button>
      <div class="header">
        {settings.showClock && <Clock name={settings.greetingName} />}
        <SearchBar engine={settings.searchEngine} onFilter={setFilter} />
      </div>
      <DialGrid dials={visible} settings={settings} onEdit={(d) => setEditing(d)} onDelete={removeDial} onReorder={reorderDials} />
      <button class="add-card" onClick={() => setEditing(null)}>+ Add card</button>

      {editing !== undefined && (
        <CardEditor settings={settings} initial={editing ?? undefined} onSave={onSave} onClose={() => setEditing(undefined)} />
      )}
      {showSettings && (
        <Settings settings={settings} onChange={updateSettings} onClose={() => setShowSettings(false)} onRestored={() => { void reload(); }} />
      )}
    </div>
  );
}

export function NewTab() {
  return <AppProvider><Board /></AppProvider>;
}
```

- [ ] **Step 4: Write the failing test `test/newtab.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { NewTab } from '../src/components/NewTab';

vi.mock('sortablejs', () => ({ default: { create: vi.fn(() => ({ destroy: vi.fn() })) } }));

describe('NewTab', () => {
  it('renders the add-card button after load', async () => {
    render(<NewTab />);
    await waitFor(() => expect(screen.getByText('+ Add card')).toBeTruthy());
  });

  it('opens the card editor when add is clicked', async () => {
    render(<NewTab />);
    await waitFor(() => screen.getByText('+ Add card'));
    fireEvent.click(screen.getByText('+ Add card'));
    expect(screen.getByText('Add card')).toBeTruthy();
  });
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/newtab.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Append remaining styles to `src/styles/global.css`**

```css
.board { position: relative; }
.settings-gear, .add-card { position: fixed; border: none; cursor: pointer; background: var(--card-bg);
  color: var(--card-fg); box-shadow: var(--card-shadow); border: var(--card-border); }
.settings-gear { top: 16px; right: 16px; width: 38px; height: 38px; border-radius: 50%; font-size: 16px; }
.add-card { bottom: 24px; left: 50%; transform: translateX(-50%); padding: 10px 20px; border-radius: 22px; font-size: 14px; }
.settings .theme-swatches { display: flex; gap: 8px; flex-wrap: wrap; }
.theme-swatch { width: 84px; height: 52px; border-radius: 10px; border: 2px solid transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center; font-size: 11px; overflow: hidden; }
.theme-swatch.active { border-color: var(--accent, #4285f4); }
.theme-add { margin-top: 8px; padding: 6px 12px; border-radius: 8px; cursor: pointer; }
.settings-warn { font-size: 11px; color: var(--muted); margin: 2px 0; }
.settings-backup { display: flex; gap: 8px; }
.import-btn { padding: 8px 16px; border-radius: 8px; background: var(--accent,#4285f4); color: #fff; cursor: pointer; }
.settings-msg { font-size: 12px; }
```

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all suites PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/ThemePicker.tsx src/components/Settings.tsx src/components/NewTab.tsx test/newtab.test.tsx src/styles/global.css
git commit -m "feat: add Settings, ThemePicker, and NewTab assembly"
```

---

## Task 13: Production build + manual Chrome verification + README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Build the extension**

Run: `npm run build`
Expected: `dist/` is produced with `manifest.json`, `index.html`, and hashed JS/CSS. No CSP/inline-script errors.

- [ ] **Step 2: Load and verify in Chrome (manual)**

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked**, select the `dist/` folder.
3. Open a new tab. Verify: clock + greeting render, search bar present, "+ Add card" works.
4. Add a card (e.g. `github.com`), verify favicon preview appears.
5. Drag a second card to reorder; open a new tab and confirm the order persisted.
6. Open Settings (⚙): switch theme (light/glass/dark) and confirm live change; create a custom theme.
7. Export backup (JSON with favicon-only cards; add an uploaded image, export again → ZIP).
8. Import the backup file and confirm cards/themes restore after the confirmation prompt.

Expected: all steps behave as described; no console errors on the new-tab page.

- [ ] **Step 3: Create `README.md`**

```markdown
# SpeedDial

A free, privacy-first new-tab speed dial for Chrome (Manifest V3). No ads, no
trackers, no telemetry. External requests happen only when you explicitly add an
image by URL or opt into the screenshot service.

## Features
- Drag-and-drop cards (SortableJS)
- Per-card previews: site icon, letter+color, uploaded image, or image URL
- Optional screenshot previews (off by default; warns before sending URLs out)
- Switchable + custom themes (Light Minimal, Glass Gradient, Dark Neon)
- Custom backgrounds (color, gradient, image)
- Clock, greeting, and web search (Google / DuckDuckGo / Bing)
- JSON / ZIP backup export & import

## Develop
```bash
npm install
npm run dev      # Vite dev server with HMR
npm test         # Vitest unit/component tests
npm run build    # outputs dist/
```

## Install (unpacked)
1. `npm run build`
2. Open `chrome://extensions`, enable Developer mode.
3. **Load unpacked** → select `dist/`.

## Privacy
- Card metadata + settings: `chrome.storage.sync` (synced across your Chrome
  profile). Falls back to local storage if the sync quota is exceeded.
- Images & backgrounds: `chrome.storage.local` (stay on this device).
- No analytics. No remote code. Default Content Security Policy is not relaxed.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README with features, dev, and privacy notes"
```

- [ ] **Step 5: Push**

```bash
git push -u origin master
```

---

## Self-Review Notes

- **Spec coverage:** MV3 newtab override (T1), Preact+Vite+crxjs (T1), minimal permissions/CSP (T1), hybrid sync/local + quota fallback (T3), favicon MV3 API + URL cache + screenshot option + cascade (T5), 3 themes + custom + background (T2/T4/T12), drag-and-drop (T9), card editor with 4 image sources (T10), search + clock + greeting (T11), JSON/ZIP export+import with validation/preview-confirm (T6/T12), tests with mocked chrome.* (T1 + every module). All §-sections map to a task.
- **Type consistency:** `Dial`, `Settings`, `Theme`, `StoredImage`, `Snapshot`, `Preview`, `ImageRef` are defined once in T2 and reused verbatim; `resolvePreview`/`letterFallback`/`faviconUrl`/`cacheImageFromUrl`/`fileToDataUrl` (T5) match their call sites in T8/T10; storage function names match across T3/T6/T7/T10/T12.
- **Screenshot mode:** `imageRef === 'screenshot'` is honored by `resolvePreview` (T5) and offered in `CardEditor` only when `settings.useScreenshots` is on (T10), gated again in `Settings` (T12). Consistent with the off-by-default spec decision.
```
