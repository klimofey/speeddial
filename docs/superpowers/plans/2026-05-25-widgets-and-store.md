# Widget System + Store (Part 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pluggable widget system — registry + `WidgetHost`, a Store to add tiles, Note + Clock widgets, with the clock moved out of the header into the grid. No migration (solo user).

**Architecture:** `Dial` gains optional `widget {type, config}`; a registry maps types to render/config components; `WidgetHost` dispatches. W1 (model + registry + widgets) and W2 (Store + card branch + config) are additive (build stays green); W3 does the header rework + removals (`WorldClocks`/`ClockSettings`/`splitWorldClocks`/dropped settings) and brings the build back green.

**Tech Stack:** TypeScript, Preact, Vitest + @testing-library/preact; reuses `formatTime`, `listTimeZones`, `t`, the grid/edit pipeline.

---

## File Structure

```
src/lib/types.ts                  # MODIFY: WidgetType/configs/WidgetInstance + Dial.widget?; (W3: drop clock settings, WorldClock)
src/lib/i18n.ts                   # MODIFY: + widget/store keys
src/components/widgets/registry.tsx   # NEW
src/components/WidgetHost.tsx         # NEW
src/components/widgets/NoteWidget.tsx # NEW (Render + ConfigEditor)
src/components/widgets/ClockWidget.tsx# NEW (Render + ConfigEditor)
src/components/widgets/Store.tsx      # NEW (gallery)
src/state/AppState.tsx            # MODIFY: addWidget
src/components/DialCard.tsx       # MODIFY: widget branch + gear/onConfig
src/components/DialGrid.tsx       # MODIFY: pass onConfig
src/components/NewTab.tsx         # MODIFY: Store + config modal; (W3: remove header clock)
src/components/Settings.tsx       # MODIFY (W3): host the global Clock-format select
src/lib/defaults.ts               # MODIFY (W3): DEFAULT_DIALS seed; drop clock settings
src/lib/storage.ts                # MODIFY (W3): getDials returns DEFAULT_DIALS when empty
src/lib/time.ts                   # MODIFY (W3): remove splitWorldClocks
# DELETED (W3): src/components/WorldClocks.tsx, ClockSettings.tsx + their tests
```

---

## Task W1: model (additive) + registry + Note/Clock widgets

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/i18n.ts`
- Create: `src/components/widgets/registry.tsx`, `src/components/WidgetHost.tsx`, `src/components/widgets/NoteWidget.tsx`, `src/components/widgets/ClockWidget.tsx`, `test/widgets.test.tsx`

- [ ] **Step 1: Extend `src/lib/types.ts` (additive)**

Add:
```ts
export type WidgetType = 'note' | 'clock';
export interface NoteConfig { text: string; }
export interface ClockConfig { timeZone: string; label: string; showGreeting: boolean; }
export type WidgetInstance =
  | { type: 'note'; config: NoteConfig }
  | { type: 'clock'; config: ClockConfig };
```
In `Dial`, after `size?...` add: `widget?: WidgetInstance;`

- [ ] **Step 2: Add i18n keys in `src/lib/i18n.ts`** — to ALL five dicts (the parity test enforces it):
```
widget_note, widget_clock, widget_link, store_title, add, note_placeholder,
clock_zone, clock_label, clock_show_greeting, coming_soon
```
English values: `widget_note:'Note'`, `widget_clock:'Clock'`, `widget_link:'Link card'`, `store_title:'Add a tile'`, `add:'+ Add'`, `note_placeholder:'Write a note…'`, `clock_zone:'Time zone'`, `clock_label:'Label'`, `clock_show_greeting:'Show greeting'`, `coming_soon:'coming soon'`. Translations (ru/es/de/fr):
- ru: 'Заметка','Часы','Карточка-ссылка','Добавить плитку','+ Добавить','Напишите заметку…','Часовой пояс','Метка','Показывать приветствие','скоро'
- es: 'Nota','Reloj','Tarjeta de enlace','Añadir un mosaico','+ Añadir','Escribe una nota…','Zona horaria','Etiqueta','Mostrar saludo','próximamente'
- de: 'Notiz','Uhr','Link-Karte','Kachel hinzufügen','+ Hinzufügen','Notiz schreiben…','Zeitzone','Beschriftung','Begrüßung anzeigen','demnächst'
- fr: 'Note','Horloge','Carte de lien','Ajouter une tuile','+ Ajouter','Écrire une note…','Fuseau horaire','Étiquette','Afficher le message','bientôt'

- [ ] **Step 3: Write `src/components/widgets/NoteWidget.tsx`**

```tsx
import { NoteConfig } from '../../lib/types';
import { t } from '../../lib/i18n';

export function NoteRender({ config }: { config: NoteConfig }) {
  return <div class="w-note">{config.text || <span class="w-note-empty">{t('note_placeholder')}</span>}</div>;
}

export function NoteConfigEditor({ config, onChange }: { config: NoteConfig; onChange: (c: NoteConfig) => void }) {
  return (
    <textarea class="w-note-edit" rows={4} value={config.text} placeholder={t('note_placeholder')}
      onInput={(e) => onChange({ text: (e.target as HTMLTextAreaElement).value })} />
  );
}
```

- [ ] **Step 4: Write `src/components/widgets/ClockWidget.tsx`**

```tsx
import { useEffect, useState } from 'preact/hooks';
import { ClockConfig, Settings } from '../../lib/types';
import { formatTime, listTimeZones, labelForZone } from '../../lib/time';
import { greeting } from '../Clock';
import { t } from '../../lib/i18n';

export function ClockRender({ config, settings }: { config: ClockConfig; settings: Settings }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  let time: string;
  try {
    time = formatTime(now, { timeZone: config.timeZone || undefined, hour12: settings.clockFormat === '12h' });
  } catch {
    time = '--:--';
  }
  const label = config.label || (config.timeZone ? labelForZone(config.timeZone) : '');
  return (
    <div class="w-clock">
      <div class="w-clock-time">{time}</div>
      {!config.timeZone && config.showGreeting && <div class="w-clock-greeting">{t(greeting(now.getHours()))}</div>}
      {label && <div class="w-clock-label">{label}</div>}
    </div>
  );
}

export function ClockConfigEditor({ config, onChange }: { config: ClockConfig; onChange: (c: ClockConfig) => void }) {
  return (
    <div class="w-clock-edit">
      <label for="wc-zone">{t('clock_zone')}</label>
      <select id="wc-zone" value={config.timeZone}
        onChange={(e) => onChange({ ...config, timeZone: (e.target as HTMLSelectElement).value })}>
        <option value="">{t('greeting_morning') ? 'Local' : 'Local'}</option>
        {listTimeZones().map((tz) => <option value={tz} key={tz}>{tz}</option>)}
      </select>
      <label for="wc-label">{t('clock_label')}</label>
      <input id="wc-label" value={config.label}
        onInput={(e) => onChange({ ...config, label: (e.target as HTMLInputElement).value })} />
      <label><input type="checkbox" checked={config.showGreeting}
        onChange={(e) => onChange({ ...config, showGreeting: (e.target as HTMLInputElement).checked })} /> {t('clock_show_greeting')}</label>
    </div>
  );
}
```
(The `'Local'` zone option label stays literal — it's the empty-timezone choice.)

- [ ] **Step 5: Write `src/components/widgets/registry.tsx`**

```tsx
import { ComponentType } from 'preact';
import { WidgetType, WidgetInstance, Settings, NoteConfig, ClockConfig } from '../../lib/types';
import { NoteRender, NoteConfigEditor } from './NoteWidget';
import { ClockRender, ClockConfigEditor } from './ClockWidget';

export interface WidgetDef {
  type: WidgetType;
  nameKey: string;
  icon: string;
  defaultSize: { w: number; h: number };
  defaultConfig: WidgetInstance['config'];
  Render: ComponentType<{ config: never; settings: Settings }>;
  ConfigEditor: ComponentType<{ config: never; onChange: (c: never) => void }>;
}

const noteDefault: NoteConfig = { text: '' };
const clockDefault: ClockConfig = { timeZone: '', label: '', showGreeting: true };

export const WIDGETS: WidgetDef[] = [
  { type: 'note', nameKey: 'widget_note', icon: '📝', defaultSize: { w: 2, h: 1 }, defaultConfig: noteDefault,
    Render: NoteRender as WidgetDef['Render'], ConfigEditor: NoteConfigEditor as WidgetDef['ConfigEditor'] },
  { type: 'clock', nameKey: 'widget_clock', icon: '🕐', defaultSize: { w: 2, h: 1 }, defaultConfig: clockDefault,
    Render: ClockRender as WidgetDef['Render'], ConfigEditor: ClockConfigEditor as WidgetDef['ConfigEditor'] },
];

export function getWidget(type: WidgetType): WidgetDef | undefined {
  return WIDGETS.find((w) => w.type === type);
}
```

- [ ] **Step 6: Write `src/components/WidgetHost.tsx`**

```tsx
import { WidgetInstance, Settings } from '../lib/types';
import { getWidget } from './widgets/registry';

export function WidgetHost({ widget, settings }: { widget: WidgetInstance; settings: Settings }) {
  const def = getWidget(widget.type);
  if (!def) return <div class="w-unknown">?</div>;
  const Render = def.Render;
  return <Render config={widget.config as never} settings={settings} />;
}
```

- [ ] **Step 7: Write `test/widgets.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { getWidget, WIDGETS } from '../src/components/widgets/registry';
import { WidgetHost } from '../src/components/WidgetHost';
import { NoteConfigEditor } from '../src/components/widgets/NoteWidget';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';

describe('widget registry', () => {
  it('lists note and clock with default sizes', () => {
    expect(WIDGETS.map((w) => w.type).sort()).toEqual(['clock', 'note']);
    expect(getWidget('note')?.defaultSize).toEqual({ w: 2, h: 1 });
  });
  it('getWidget returns undefined for unknown', () => {
    expect(getWidget('nope' as never)).toBeUndefined();
  });
});

describe('WidgetHost', () => {
  it('renders a note widget', () => {
    render(<WidgetHost widget={{ type: 'note', config: { text: 'hello' } }} settings={DEFAULT_SETTINGS} />);
    expect(screen.getByText('hello')).toBeTruthy();
  });
  it('renders a clock widget time', () => {
    const { container } = render(<WidgetHost widget={{ type: 'clock', config: { timeZone: 'UTC', label: 'UTC', showGreeting: false } }} settings={DEFAULT_SETTINGS} />);
    expect(container.querySelector('.w-clock-time')?.textContent).toMatch(/\d\d:\d\d/);
  });
  it('renders a placeholder for an unknown type', () => {
    const { container } = render(<WidgetHost widget={{ type: 'xxx', config: {} } as never} settings={DEFAULT_SETTINGS} />);
    expect(container.querySelector('.w-unknown')).toBeTruthy();
  });
});

describe('NoteConfigEditor', () => {
  it('emits text changes', () => {
    const onChange = vi.fn();
    render(<NoteConfigEditor config={{ text: '' }} onChange={onChange} />);
    fireEvent.input(screen.getByPlaceholderText('Write a note…'), { target: { value: 'hi' } });
    expect(onChange).toHaveBeenCalledWith({ text: 'hi' });
  });
});
```

- [ ] **Step 8: Run + commit**

Run: `npx vitest run test/widgets.test.tsx` → PASS. Then `npm test` (all pass — additive) and `npx tsc --noEmit` (0 errors). Append widget styles to `src/styles/global.css`:
```css
.w-note { padding: 10px; font-size: 13px; white-space: pre-wrap; overflow: auto; width: 100%; height: 100%; }
.w-note-empty { color: var(--muted); }
.w-note-edit { width: 100%; }
.w-clock { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; }
.w-clock-time { font-size: 28px; font-weight: 700; }
.w-clock-greeting, .w-clock-label { font-size: 11px; color: var(--muted); }
.w-clock-edit { display: flex; flex-direction: column; gap: 6px; }
.w-unknown { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: var(--muted); font-size: 24px; }
```
```bash
git add src/lib/types.ts src/lib/i18n.ts src/components/widgets/ src/components/WidgetHost.tsx test/widgets.test.tsx src/styles/global.css
git commit -m "feat: widget registry, WidgetHost, Note and Clock widgets"
```

---

## Task W2: Store + card widget branch + config (additive)

**Files:**
- Create: `src/components/widgets/Store.tsx`, `test/store.test.tsx`
- Modify: `src/state/AppState.tsx`, `src/components/DialCard.tsx`, `src/components/DialGrid.tsx`, `src/components/NewTab.tsx`, `test/appstate.test.tsx`, `test/dialcard.test.tsx`

- [ ] **Step 1: `AppState.addWidget`** — in `AppContextValue` add `addWidget: (type: WidgetType) => Promise<void>;`. Implement (uses registry defaults):
```tsx
  const addWidget = useCallback(async (type: WidgetType) => {
    const def = getWidget(type);
    if (!def) return;
    const item: Dial = {
      id: uid(), url: '', title: '', imageRef: 'letter', color: '', order: dials.length,
      size: def.defaultSize, widget: { type, config: structuredClone(def.defaultConfig) } as WidgetInstance,
    };
    await persistDials([...dials, item]);
  }, [dials, persistDials]);
```
Import `getWidget` and `WidgetType, WidgetInstance`. Add `addWidget` to the context value. Add a test in `test/appstate.test.tsx`: addWidget('note') → a dial with `widget.type==='note'` appended.

- [ ] **Step 2: `DialCard` widget branch** — add props `onConfig?: (dial: Dial) => void`. At the top, if `dial.widget`:
```tsx
  if (dial.widget) {
    return (
      <div class={`dial-card widget-card${editing ? ' editing' : ''}`} data-id={dial.id}
        style={{ gridColumn: `span ${size.w}`, gridRow: `span ${size.h}` }}>
        <div class="dial-thumb"><WidgetHost widget={dial.widget} settings={settings} /></div>
        <div class="dial-actions">
          <button aria-label={`Configure ${dial.widget.type}`} onClick={() => onConfig?.(dial)}>⚙</button>
          <button aria-label={`${t('delete')} widget`} onClick={() => onDelete(dial.id)}>✕</button>
        </div>
        {editing && <span class="dial-resize" aria-label="Resize widget" role="button" onMouseDown={startResize} />}
      </div>
    );
  }
```
(Import `WidgetHost`, `t`. Keep the existing link rendering below for non-widget dials. `startResize`/`size` already defined.)
Add a `test/dialcard.test.tsx` test: a `dial` with `widget:{type:'note',config:{text:'x'}}` renders `.widget-card`, the note text, a Configure button calling `onConfig`, and no `<a>`.

- [ ] **Step 3: `DialGrid`** — add `onConfig?: (dial: Dial) => void` prop and pass `onConfig={onConfig}` to each `<DialCard>`.

- [ ] **Step 4: `Store.tsx`**

```tsx
import { WIDGETS } from './registry';
import { WidgetType } from '../../lib/types';
import { t } from '../../lib/i18n';

interface Props { onAddLink: () => void; onAddWidget: (type: WidgetType) => void; onClose: () => void; }

export function Store({ onAddLink, onAddWidget, onClose }: Props) {
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t('store_title')}</h3>
        <div class="store-grid">
          <button class="store-item" onClick={onAddLink}><span class="store-icon">🔗</span>{t('widget_link')}</button>
          {WIDGETS.map((w) => (
            <button class="store-item" key={w.type} onClick={() => onAddWidget(w.type)}>
              <span class="store-icon">{w.icon}</span>{t(w.nameKey)}
            </button>
          ))}
          <button class="store-item" disabled><span class="store-icon">☁️</span>Weather <em>({t('coming_soon')})</em></button>
        </div>
        <div class="modal-actions"><button onClick={onClose}>{t('close')}</button></div>
      </div>
    </div>
  );
}
```
`test/store.test.tsx`: renders Link + Note + Clock; clicking Note calls `onAddWidget('note')`; clicking Link calls `onAddLink`.

- [ ] **Step 5: `NewTab` — Store + config modal (additive; header clock still present this task)**

- Add imports: `import { Store } from './widgets/Store';`, `import { getWidget } from './widgets/registry';`, and `addWidget` from `useApp()`.
- State: `const [showStore, setShowStore] = useState(false);` and `const [configuring, setConfiguring] = useState<Dial | null>(null);`
- Change the bottom button from "+ Add card" to open the Store: `<button class="add-card" onClick={() => setShowStore(true)}>{t('add')}</button>`.
- Pass `onConfig={(d) => setConfiguring(d)}` to `<DialGrid>`.
- Render the Store modal:
```tsx
      {showStore && (
        <Store
          onAddLink={() => { setShowStore(false); setEditing(null); }}
          onAddWidget={async (type) => { setShowStore(false); await addWidget(type); }}
          onClose={() => setShowStore(false)}
        />
      )}
```
- Render the widget config modal:
```tsx
      {configuring?.widget && (() => {
        const def = getWidget(configuring.widget.type);
        const Editor = def?.ConfigEditor;
        return (
          <div class="modal-backdrop" onClick={() => setConfiguring(null)}>
            <div class="modal" onClick={(e) => e.stopPropagation()}>
              <h3>{def ? t(def.nameKey) : ''}</h3>
              {Editor && (
                <Editor config={configuring.widget.config as never}
                  onChange={(config: never) => {
                    const updated: Dial = { ...configuring, widget: { type: configuring.widget!.type, config } as Dial['widget'] };
                    setConfiguring(updated);
                    void updateDial(updated);
                  }} />
              )}
              <div class="modal-actions"><button onClick={() => setConfiguring(null)}>{t('close')}</button></div>
            </div>
          </div>
        );
      })()}
```
- After `addWidget`, open its config: change `onAddWidget` to also set `configuring` to the newly added dial. Simplest: after `await addWidget(type)`, the new dial is the last of `dials`; but `dials` is stale in the closure. Acceptable for this task: just add it; the user clicks its ⚙ to configure. (Auto-open is a nice-to-have; skip to avoid stale-closure complexity.)
- Add a NewTab test: clicking "+ Add" shows the Store ("Add a tile"); clicking "Note" in the store adds a tile.

- [ ] **Step 6: styles + commit**

Append to `src/styles/global.css`:
```css
.store-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.store-item { display: flex; align-items: center; gap: 8px; padding: 12px; border-radius: 10px; cursor: pointer;
  border: var(--card-border); background: var(--search-bg); color: inherit; font-size: 14px; }
.store-item:disabled { opacity: .5; cursor: not-allowed; }
.store-icon { font-size: 18px; }
.widget-card .dial-thumb { padding: 0; }
.widget-card.editing .dial-actions { display: flex; }
```
Run `npm test` (all pass), `npx tsc --noEmit` (0 errors).
```bash
git add src/state/AppState.tsx src/components/DialCard.tsx src/components/DialGrid.tsx src/components/widgets/Store.tsx src/components/NewTab.tsx test/appstate.test.tsx test/dialcard.test.tsx test/store.test.tsx test/widgets.test.tsx src/styles/global.css
git commit -m "feat: Store gallery, widget card rendering, and config modal"
```

---

## Task W3: header rework + remove old clock pieces + seed default; build & push

**Files:**
- Modify: `src/components/NewTab.tsx`, `src/lib/types.ts`, `src/lib/defaults.ts`, `src/lib/storage.ts`, `src/lib/time.ts`, `src/components/Settings.tsx`, `test/*`
- Delete: `src/components/WorldClocks.tsx`, `src/components/ClockSettings.tsx`, `test/worldclocks.test.tsx`, `test/clocksettings.test.tsx`

- [ ] **Step 1: Remove the header clock from `NewTab.tsx`**

Delete the entire `{settings.showClock && (<div class="clock-widget">…</div>)}` block, the `showClockConfig` state, the `{showClockConfig && …}` modal, the `setLang`-adjacent `splitWorldClocks`/`leftClocks`/`rightClocks` lines, and the `Clock`/`WorldClocks`/`ClockSettings`/`splitWorldClocks` imports. The header keeps only `<SearchBar …/>`.

- [ ] **Step 2: Drop clock settings from `types.ts` + `defaults.ts`; add `DEFAULT_DIALS`**

- `types.ts`: remove `showClock`, `greetingName`, `worldClocks` from `Settings`; remove the `WorldClock` interface.
- `defaults.ts`: remove those three from `DEFAULT_SETTINGS` (keep `clockFormat`). Add:
```ts
export const DEFAULT_DIALS: Dial[] = [
  { id: 'seed-clock', url: '', title: '', imageRef: 'letter', color: '', order: 0,
    size: { w: 2, h: 1 }, widget: { type: 'clock', config: { timeZone: '', label: '', showGreeting: true } } },
];
```

- [ ] **Step 3: `storage.getDials` seeds the default**

```ts
export async function getDials(): Promise<Dial[]> {
  const dials = await getSynced<Dial[] | undefined>(K_DIALS, undefined);
  const base = dials ?? DEFAULT_DIALS;
  return [...base].sort((a, b) => a.order - b.order).map((d) => ({ ...d, size: d.size ?? { w: 1, h: 1 } }));
}
```
Import `DEFAULT_DIALS`. Update the storage test that expected `[]` for empty to expect the seeded clock; keep the "defaults a missing size" test (set a stored dial explicitly first).

- [ ] **Step 4: `time.ts` — remove `splitWorldClocks`** (and its tests in `test/time.test.ts`).

- [ ] **Step 5: `Settings.tsx` — host the global Clock-format select**

Add a Clock-format `<select>` (label `t('clock_format')`, options `t('fmt_24')`/`t('fmt_12')`) bound to `settings.clockFormat` (it was previously rendered by the deleted `ClockSettings`). Place it near the card-size select.

- [ ] **Step 6: Delete obsolete components + tests**

`git rm src/components/WorldClocks.tsx src/components/ClockSettings.tsx test/worldclocks.test.tsx test/clocksettings.test.tsx`. Also update `test/clock.test.tsx`: the `greeting()` unit tests stay (ClockWidget imports `greeting`); delete the `Clock`-component render tests if the `Clock` component is no longer rendered — keep `Clock.tsx` exporting `greeting` (used by ClockWidget) but if its `Clock` component is now unused, remove the component and keep/relocate `greeting`. Simplest: keep `greeting` in `Clock.tsx` and delete the `Clock` component + its render tests, leaving the three `greeting` key tests.

- [ ] **Step 7: Fix all references + tests**

Search for remaining uses of `settings.showClock`, `settings.worldClocks`, `settings.greetingName`, `WorldClocks`, `ClockSettings`, `splitWorldClocks` and remove them. Update `test/settings.test.tsx` (remove the language/clock tests that referenced removed controls only if they break; the language picker test stays; add a Clock-format test). Update `test/newtab.test.tsx`: remove the clock-gear test; keep add/edit tests; the header no longer shows a clock.

- [ ] **Step 8: Full green, build, push**

Run `npm test` → all pass (report count). `npx tsc --noEmit` → 0 errors. `npm run build` → clean dist/; `find src test -name '*.js'` empty.
```bash
git add -A
git commit -m "feat: move clock into the grid as a widget; remove header clock and old clock settings"
git push origin feat/widgets-store
```

- [ ] **Step 9: PR**

```bash
gh pr create --base master --head feat/widgets-store --title "Part 2: widget system + Store" --body "Pluggable widget registry + WidgetHost, a Store to add tiles, Note and Clock widgets, with the clock moved into the grid. No migration (solo). 🤖 Generated with Claude Code"
```

---

## Self-Review Notes

- **Spec coverage:** model+`Dial.widget` (W1); registry/host/Note/Clock (W1); Store + card branch + config modal + addWidget (W2); header rework + seed + dropped settings + format-select move + removals (W3). i18n keys (W1). All spec sections map to a task.
- **Type consistency:** `WidgetInstance`/`NoteConfig`/`ClockConfig` defined W1, used by registry/host/AppState/NewTab; `getWidget`/`WIDGETS` consistent; `addWidget(type)` and `onConfig` consistent across AppState/DialGrid/DialCard/NewTab.
- **Build sequencing (flagged):** W1+W2 are additive (build stays green). W3 is the breaking task — it removes `WorldClocks`/`ClockSettings`/`splitWorldClocks` and three settings fields and rewires the header, then restores green. Don't run the full build expecting green until W3 completes; per-task targeted vitest stays green throughout.
- **No migration:** `getDials` seeds `DEFAULT_DIALS` (one clock) only when nothing is stored; existing stored dials are kept as-is (no clock auto-added) — acceptable per the solo/no-migration decision.
- **Placeholder scan:** none.
```
