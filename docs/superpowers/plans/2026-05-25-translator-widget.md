# Translator Widget (Part 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A Translator widget — type text, auto-detect the language, show a translation in a chosen target language; on-device (Chrome Translator/LanguageDetector APIs) first, optional MyMemory cloud fallback.

**Architecture:** A pure engine module `src/lib/translate.ts` (feature-detects the on-device APIs, falls back to MyMemory) + a `translator` widget registered in the existing widget registry. Additive — no changes to other widgets.

**Tech Stack:** TypeScript, Preact, Vitest + @testing-library/preact. Chrome built-in `Translator`/`LanguageDetector` (feature-detected). Reuses `t`, the widget registry/Store, `chrome.permissions`.

---

## File Structure
```
src/lib/types.ts                        # MODIFY: WidgetType 'translator', TranslatorConfig, WidgetInstance arm
src/lib/translate.ts                    # NEW: detect/onDevice/cloud/orchestrator + TRANSLATE_LANGS
src/lib/permissions.ts                  # MODIFY: MYMEMORY_ORIGIN + ensureMyMemoryPermission
src/lib/i18n.ts                         # MODIFY: + translator keys (5 langs)
manifest.config.ts                      # MODIFY: optional_host_permissions += MyMemory origin
src/lib/dev-chrome-shim.ts              # MODIFY: stub Translator + LanguageDetector
src/components/widgets/TranslatorWidget.tsx   # NEW: Render + ConfigEditor
src/components/widgets/registry.tsx     # MODIFY: register translator
src/styles/global.css                   # MODIFY: .w-translate* styles
test/translate.test.ts                  # NEW
test/translator-widget.test.tsx         # NEW
```

---

## Task T1: engine + model + i18n + permissions (no UI)

**Files:** Modify `src/lib/types.ts`, `src/lib/i18n.ts`, `src/lib/permissions.ts`, `manifest.config.ts`; Create `src/lib/translate.ts`, `test/translate.test.ts`.

- [ ] **Step 1: types** — in `src/lib/types.ts`:
  - Change `export type WidgetType = 'note' | 'clock';` → `export type WidgetType = 'note' | 'clock' | 'translator';`
  - Add `export interface TranslatorConfig { target: string; cloudFallback: boolean; }`
  - Extend the union: add `| { type: 'translator'; config: TranslatorConfig }` to `WidgetInstance`.

- [ ] **Step 2: i18n** — add these keys to ALL FIVE dicts in `src/lib/i18n.ts` (parity test enforces identical key sets). English values then the ru/es/de/fr translations:
  - `widget_translator`: 'Translator' | 'Переводчик' | 'Traductor' | 'Übersetzer' | 'Traducteur'
  - `translate_placeholder`: 'Enter text…' | 'Введите текст…' | 'Escribe el texto…' | 'Text eingeben…' | 'Saisir le texte…'
  - `translate_to`: 'Translate to' | 'Перевести на' | 'Traducir a' | 'Übersetzen nach' | 'Traduire en'
  - `detected`: 'Detected' | 'Определено' | 'Detectado' | 'Erkannt' | 'Détecté'
  - `translating`: 'Translating…' | 'Перевод…' | 'Traduciendo…' | 'Übersetze…' | 'Traduction…'
  - `downloading_model`: 'Downloading model' | 'Загрузка модели' | 'Descargando modelo' | 'Modell wird geladen' | 'Téléchargement du modèle'
  - `translator_unavailable`: 'Translation unavailable — enable cloud fallback in ⚙' | 'Перевод недоступен — включите облако в ⚙' | 'Traducción no disponible — activa la nube en ⚙' | 'Übersetzung nicht verfügbar — Cloud in ⚙ aktivieren' | 'Traduction indisponible — activez le cloud dans ⚙'
  - `cloud_fallback`: 'Allow cloud translation' | 'Разрешить облачный перевод' | 'Permitir traducción en la nube' | 'Cloud-Übersetzung erlauben' | 'Autoriser la traduction cloud'
  - `cloud_fallback_warn`: 'When on-device translation is unavailable, your text is sent to MyMemory.' | 'Когда перевод на устройстве недоступен, ваш текст отправляется в MyMemory.' | 'Cuando la traducción en el dispositivo no está disponible, tu texto se envía a MyMemory.' | 'Wenn die Übersetzung auf dem Gerät nicht verfügbar ist, wird dein Text an MyMemory gesendet.' | 'Quand la traduction sur l’appareil est indisponible, votre texte est envoyé à MyMemory.'

- [ ] **Step 3: permissions** — in `src/lib/permissions.ts` add (match the file's existing style for the Google helper):
```ts
export const MYMEMORY_ORIGIN = 'https://api.mymemory.translated.net/*';

export async function ensureMyMemoryPermission(): Promise<boolean> {
  try {
    if (await chrome.permissions.contains({ origins: [MYMEMORY_ORIGIN] })) return true;
    return await chrome.permissions.request({ origins: [MYMEMORY_ORIGIN] });
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: manifest** — in `manifest.config.ts` add `'https://api.mymemory.translated.net/*'` to the `optional_host_permissions` array (keep existing entries).

- [ ] **Step 5: write `src/lib/translate.ts`**
```ts
export interface TranslateResult {
  text: string;
  source: string; // detected/used source language code ('' if unknown)
  via: 'device' | 'cloud' | 'none';
  status?: 'downloading' | 'unavailable';
}

interface TranslatorGlobal {
  availability(opts: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(opts: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (m: { addEventListener: (t: string, cb: (e: { loaded: number }) => void) => void }) => void;
  }): Promise<{ translate(text: string): Promise<string> }>;
}
interface DetectorGlobal {
  availability(): Promise<string>;
  create(): Promise<{ detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]> }>;
}

function translatorAPI(): TranslatorGlobal | null {
  const g = globalThis as unknown as { Translator?: TranslatorGlobal };
  return g.Translator ?? null;
}
function detectorAPI(): DetectorGlobal | null {
  const g = globalThis as unknown as { LanguageDetector?: DetectorGlobal };
  return g.LanguageDetector ?? null;
}

export async function detectLanguage(text: string): Promise<string | null> {
  const api = detectorAPI();
  if (!text.trim() || !api) return null;
  try {
    if ((await api.availability()) === 'unavailable') return null;
    const detector = await api.create();
    const results = await detector.detect(text);
    return results?.[0]?.detectedLanguage ?? null;
  } catch {
    return null;
  }
}

export async function translateOnDevice(
  text: string, source: string, target: string, onDownload?: (p: number) => void,
): Promise<string | null> {
  if (source === target) return text;
  const api = translatorAPI();
  if (!api || !source) return null;
  try {
    if ((await api.availability({ sourceLanguage: source, targetLanguage: target })) === 'unavailable') return null;
    const translator = await api.create({
      sourceLanguage: source,
      targetLanguage: target,
      monitor(m) { m.addEventListener('downloadprogress', (e) => onDownload?.(e.loaded)); },
    });
    return await translator.translate(text);
  } catch {
    return null;
  }
}

export async function translateCloud(text: string, source: string, target: string): Promise<string | null> {
  try {
    const langpair = `${source || 'autodetect'}|${target}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { responseData?: { translatedText?: string } };
    return data?.responseData?.translatedText ?? null;
  } catch {
    return null;
  }
}

export async function translate(
  text: string, target: string, opts: { cloudFallback: boolean; onDownload?: (p: number) => void },
): Promise<TranslateResult> {
  const trimmed = text.trim();
  if (!trimmed) return { text: '', source: '', via: 'none' };
  const source = (await detectLanguage(trimmed)) ?? '';
  if (source && source === target) return { text, source, via: 'device' };
  if (source) {
    const onDev = await translateOnDevice(trimmed, source, target, opts.onDownload);
    if (onDev != null) return { text: onDev, source, via: 'device' };
  }
  if (opts.cloudFallback) {
    const cloud = await translateCloud(trimmed, source, target);
    if (cloud != null) return { text: cloud, source, via: 'cloud' };
  }
  return { text: '', source, via: 'none', status: 'unavailable' };
}

export const TRANSLATE_LANGS: { code: string; label: string }[] = [
  { code: 'en', label: 'English' }, { code: 'es', label: 'Español' }, { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' }, { code: 'ru', label: 'Русский' }, { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' }, { code: 'nl', label: 'Nederlands' }, { code: 'pl', label: 'Polski' },
  { code: 'tr', label: 'Türkçe' }, { code: 'uk', label: 'Українська' }, { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' }, { code: 'zh', label: '中文' }, { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' },
];
```

- [ ] **Step 6: write `test/translate.test.ts`**
```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { translate, detectLanguage } from '../src/lib/translate';

const g = globalThis as unknown as { Translator?: unknown; LanguageDetector?: unknown };

function stubDetector(lang: string | null) {
  g.LanguageDetector = lang == null
    ? undefined
    : { async availability() { return 'available'; },
        async create() { return { async detect() { return [{ detectedLanguage: lang, confidence: 1 }]; } }; } };
}
function stubTranslator(result: string | null) {
  g.Translator = result == null
    ? undefined
    : { async availability() { return 'available'; },
        async create() { return { async translate(t: string) { return `${result}:${t}`; } }; } };
}

afterEach(() => { g.Translator = undefined; g.LanguageDetector = undefined; vi.unstubAllGlobals(); });

describe('translate orchestrator', () => {
  it('returns empty for blank input', async () => {
    expect((await translate('   ', 'en', { cloudFallback: false })).via).toBe('none');
  });

  it('short-circuits when source equals target', async () => {
    stubDetector('en');
    const r = await translate('hello', 'en', { cloudFallback: false });
    expect(r.via).toBe('device');
    expect(r.text).toBe('hello');
  });

  it('translates on-device when available', async () => {
    stubDetector('ru');
    stubTranslator('OUT');
    const r = await translate('привет', 'en', { cloudFallback: false });
    expect(r.via).toBe('device');
    expect(r.text).toBe('OUT:привет');
    expect(r.source).toBe('ru');
  });

  it('falls back to cloud when on-device is unavailable and cloudFallback is on', async () => {
    stubDetector('ru');
    g.Translator = undefined; // no on-device translator
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ responseData: { translatedText: 'CLOUD' } }) })));
    const r = await translate('привет', 'en', { cloudFallback: true });
    expect(r.via).toBe('cloud');
    expect(r.text).toBe('CLOUD');
  });

  it('reports unavailable when nothing works and cloud is off', async () => {
    stubDetector('ru');
    g.Translator = undefined;
    const r = await translate('привет', 'en', { cloudFallback: false });
    expect(r.via).toBe('none');
    expect(r.status).toBe('unavailable');
  });

  it('detectLanguage returns null without the API', async () => {
    g.LanguageDetector = undefined;
    expect(await detectLanguage('hi')).toBeNull();
  });
});
```

- [ ] **Step 7: verify + commit**
  - `npx vitest run test/translate.test.ts` → PASS.
  - `npm test` → all pass (additive). `npx tsc --noEmit` → 0 errors.
  - `git add src/lib/types.ts src/lib/i18n.ts src/lib/permissions.ts src/lib/translate.ts manifest.config.ts test/translate.test.ts && git commit -m "feat: translation engine (on-device + MyMemory fallback) + model/i18n/perms"`

---

## Task T2: Translator widget + registry + dev-shim + styles

**Files:** Create `src/components/widgets/TranslatorWidget.tsx`, `test/translator-widget.test.tsx`; Modify `src/components/widgets/registry.tsx`, `src/lib/dev-chrome-shim.ts`, `src/styles/global.css`.

- [ ] **Step 1: write `src/components/widgets/TranslatorWidget.tsx`**
```tsx
import { useEffect, useRef, useState } from 'preact/hooks';
import { TranslatorConfig } from '../../lib/types';
import { translate, TranslateResult, TRANSLATE_LANGS } from '../../lib/translate';
import { ensureMyMemoryPermission } from '../../lib/permissions';
import { t } from '../../lib/i18n';

export function TranslatorRender({ config }: { config: TranslatorConfig }) {
  const [input, setInput] = useState('');
  const [out, setOut] = useState<TranslateResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    if (!input.trim()) { setOut(null); return; }
    timer.current = setTimeout(async () => {
      setBusy(true); setProgress(null);
      const r = await translate(input, config.target, {
        cloudFallback: config.cloudFallback,
        onDownload: (p) => setProgress(Math.round(p * 100)),
      });
      setOut(r); setBusy(false); setProgress(null);
    }, 500);
    return () => clearTimeout(timer.current);
  }, [input, config.target, config.cloudFallback]);

  return (
    <div class="w-translate">
      <textarea class="w-translate-in" rows={2} value={input} placeholder={t('translate_placeholder')}
        onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)} />
      <div class="w-translate-out">
        {busy && <span class="w-translate-status">{progress != null ? `${t('downloading_model')} ${progress}%` : t('translating')}</span>}
        {!busy && out?.via === 'none' && <span class="w-translate-status">{t('translator_unavailable')}</span>}
        {!busy && out && out.via !== 'none' && (
          <>
            <span class="w-translate-detected">{t('detected')}: {out.source || '?'} → {config.target}{out.via === 'cloud' ? ' ☁' : ''}</span>
            <div class="w-translate-text">{out.text}</div>
          </>
        )}
      </div>
    </div>
  );
}

export function TranslatorConfigEditor({ config, onChange }: { config: TranslatorConfig; onChange: (c: TranslatorConfig) => void }) {
  const onCloudToggle = async (checked: boolean) => {
    if (checked) onChange({ ...config, cloudFallback: await ensureMyMemoryPermission() });
    else onChange({ ...config, cloudFallback: false });
  };
  return (
    <div class="w-translate-edit">
      <label for="tr-target">{t('translate_to')}</label>
      <select id="tr-target" value={config.target}
        onChange={(e) => onChange({ ...config, target: (e.target as HTMLSelectElement).value })}>
        {TRANSLATE_LANGS.map((l) => <option value={l.code} key={l.code}>{l.label}</option>)}
      </select>
      <label><input type="checkbox" checked={config.cloudFallback}
        onChange={(e) => onCloudToggle((e.target as HTMLInputElement).checked)} /> {t('cloud_fallback')}</label>
      <p class="settings-warn">{t('cloud_fallback_warn')}</p>
    </div>
  );
}
```

- [ ] **Step 2: register in `src/components/widgets/registry.tsx`**
  - Import: `import { TranslatorRender, TranslatorConfigEditor } from './TranslatorWidget';` and add `TranslatorConfig` to the `../../lib/types` import.
  - Add `const translatorDefault: TranslatorConfig = { target: 'en', cloudFallback: false };`
  - Append to `WIDGETS`:
```tsx
  { type: 'translator', nameKey: 'widget_translator', icon: '🌐', defaultSize: { w: 2, h: 2 }, defaultConfig: translatorDefault,
    Render: TranslatorRender as unknown as WidgetDef['Render'], ConfigEditor: TranslatorConfigEditor as unknown as WidgetDef['ConfigEditor'] },
```

- [ ] **Step 3: dev-shim stubs** — in `src/lib/dev-chrome-shim.ts`, after the chrome mock block, add (so the widget works under vite dev / Playwright):
```ts
const gg = globalThis as unknown as { Translator?: unknown; LanguageDetector?: unknown };
if (typeof gg.Translator === 'undefined') {
  gg.Translator = {
    async availability() { return 'available'; },
    async create(opts: { sourceLanguage: string; targetLanguage: string }) {
      return { async translate(text: string) { return `[${opts.sourceLanguage}→${opts.targetLanguage}] ${text}`; } };
    },
  };
}
if (typeof gg.LanguageDetector === 'undefined') {
  gg.LanguageDetector = {
    async availability() { return 'available'; },
    async create() { return { async detect() { return [{ detectedLanguage: 'en', confidence: 1 }]; } }; },
  };
}
```

- [ ] **Step 4: styles** — append to `src/styles/global.css`:
```css
.w-translate { display: flex; flex-direction: column; gap: 6px; width: 100%; height: 100%; padding: 8px; box-sizing: border-box; }
.w-translate-in { resize: none; flex: 0 0 auto; border-radius: 8px; border: var(--card-border); background: var(--search-bg); color: inherit; padding: 6px 8px; font: inherit; }
.w-translate-out { flex: 1 1 auto; min-height: 0; overflow: auto; font-size: 13px; }
.w-translate-detected { font-size: 10px; color: var(--muted); display: block; margin-bottom: 2px; }
.w-translate-status { font-size: 11px; color: var(--muted); }
.w-translate-text { white-space: pre-wrap; }
.w-translate-edit { display: flex; flex-direction: column; gap: 6px; }
```

- [ ] **Step 5: write `test/translator-widget.test.tsx`**
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { TranslatorRender, TranslatorConfigEditor } from '../src/components/widgets/TranslatorWidget';

const g = globalThis as unknown as { Translator?: unknown; LanguageDetector?: unknown };

beforeEach(() => {
  g.LanguageDetector = { async availability() { return 'available'; },
    async create() { return { async detect() { return [{ detectedLanguage: 'ru', confidence: 1 }]; } }; } };
  g.Translator = { async availability() { return 'available'; },
    async create() { return { async translate(t: string) { return `EN:${t}`; } }; } };
});
afterEach(() => { g.Translator = undefined; g.LanguageDetector = undefined; vi.useRealTimers(); });

describe('TranslatorRender', () => {
  it('translates debounced input on-device', async () => {
    render(<TranslatorRender config={{ target: 'en', cloudFallback: false }} />);
    fireEvent.input(screen.getByPlaceholderText('Enter text…'), { target: { value: 'привет' } });
    await waitFor(() => expect(screen.getByText('EN:привет')).toBeTruthy(), { timeout: 2000 });
  });
});

describe('TranslatorConfigEditor', () => {
  it('emits target language changes', () => {
    const onChange = vi.fn();
    render(<TranslatorConfigEditor config={{ target: 'en', cloudFallback: false }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Translate to'), { target: { value: 'fr' } });
    expect(onChange).toHaveBeenCalledWith({ target: 'fr', cloudFallback: false });
  });

  it('requests permission when enabling cloud fallback', async () => {
    const onChange = vi.fn();
    render(<TranslatorConfigEditor config={{ target: 'en', cloudFallback: false }} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Allow cloud translation'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ target: 'en', cloudFallback: true }));
  });
});
```
NOTE: the cloud-permission test relies on the test/setup.ts chrome mock's `permissions.request`/`contains` resolving truthy. If the mock returns falsy by default, adjust the test to stub `chrome.permissions.request` to resolve `true` for this case (do not change production code).

- [ ] **Step 6: verify + commit + build + push**
  - `npx vitest run test/translator-widget.test.tsx test/translate.test.ts test/widgets.test.tsx` → PASS.
  - `npm test` → all pass. `npx tsc --noEmit` → 0. `npm run build` → clean; `find src test -name '*.js'` empty; confirm the shim/translator stubs are NOT in `dist` (grep dist for `LanguageDetector` → only legit translate.ts feature-detect, not the dev stub `[${opts...}]` echo string).
  - `git add -A && git commit -m "feat: translator widget (render + config) + registry + dev stubs + styles"`
  - `git push origin feat/translator-widget`
  - Do NOT open the PR (the controller handles finishing).

---

## Self-Review Notes
- **Spec coverage:** model+config (T1.1); engine detect/onDevice/cloud/orchestrator (T1.5); permissions+manifest (T1.3/4); i18n (T1.2); widget Render+ConfigEditor (T2.1); registry/Store (T2.2); dev shim (T2.3); styles (T2.4); tests (T1.6, T2.5). All spec sections mapped.
- **Type consistency:** `TranslatorConfig {target,cloudFallback}`, `TranslateResult {text,source,via,status?}`, `translate(text,target,{cloudFallback,onDownload?})`, `ensureMyMemoryPermission()`, registry `as unknown as WidgetDef[...]` casts — consistent across tasks.
- **Build sequencing:** both tasks additive; build stays green throughout.
- **Placeholder scan:** none.
- **Risk:** on-device APIs absent in jsdom — all tests stub the globals; production feature-detects and returns null/none gracefully.
