import { useEffect, useState } from 'preact/hooks';
import { AppProvider, useApp } from '../state/AppState';
import { applyTheme } from '../lib/themes';
import { getImage } from '../lib/storage';
import { Dial } from '../lib/types';
import { setLang, t } from '../lib/i18n';
import { Clock } from './Clock';
import { SearchBar } from './SearchBar';
import { DialGrid } from './DialGrid';
import { CardEditor } from './CardEditor';
import { Settings } from './Settings';
import { ClockSettings } from './ClockSettings';
import { WorldClocks } from './WorldClocks';
import { splitWorldClocks } from '../lib/time';
import { getRecentSites, RecentSite } from '../lib/recent';
import { RecentRow } from './RecentRow';
import { Store } from './widgets/Store';
import { getWidget } from './widgets/registry';

function Board() {
  const { ready, dials, settings, addDial, addWidget, updateDial, removeDial, reorderDials, resizeDial, updateSettings, reload } = useApp();
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<Dial | null | undefined>(undefined); // undefined=closed, null=new
  const [showSettings, setShowSettings] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showClockConfig, setShowClockConfig] = useState(false);
  const [recentSites, setRecentSites] = useState<RecentSite[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [showStore, setShowStore] = useState(false);
  const [configuring, setConfiguring] = useState<Dial | null>(null);

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

  // When the System theme is active, re-apply on OS light/dark changes (live).
  useEffect(() => {
    if (settings.activeThemeId !== 'system' || typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(settings);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings]);

  // Load recent sites (excluding already-pinned) when enabled. `recentLoading`
  // keeps the skeleton up until the first result, so the row reserves its space
  // instead of popping in and shoving the grid down.
  useEffect(() => {
    if (!ready || !settings.showRecent) { setRecentSites([]); setRecentLoading(false); return; }
    setRecentLoading(true);
    void getRecentSites({ excludeUrls: dials.map((d) => d.url), limit: 16 }).then((sites) => {
      setRecentSites(sites);
      setRecentLoading(false);
    });
  }, [ready, settings.showRecent, dials]);

  if (!ready) return null;

  setLang(settings.language);

  const { left: leftClocks, right: rightClocks } = splitWorldClocks(settings.worldClocks);

  const visible = filter
    ? dials.filter((d) => (d.title + ' ' + d.url).toLowerCase().includes(filter.toLowerCase()))
    : dials;

  const onPinRecent = async (site: RecentSite) => {
    await addDial({ url: site.url, title: site.title });
  };

  const onSave = async (input: Omit<Dial, 'order'> & { order?: number }) => {
    if (input.id) await updateDial({ ...input, order: input.order ?? 0 } as Dial);
    else await addDial({ url: input.url, title: input.title });
    setEditing(undefined);
  };

  return (
    <div class="board">
      <button class="settings-gear" aria-label={t('open_settings')} onClick={() => setShowSettings(true)}>⚙</button>
      <button class="edit-toggle" onClick={() => setEditMode((v) => !v)}>{editMode ? t('done') : t('edit')}</button>

      <div class="header">
        {settings.showClock && (
          <div class={`clock-widget${editMode ? ' widget-edit' : ''}`}>
            {editMode && (
              <button class="widget-gear" aria-label={t('clock_settings')} onClick={() => setShowClockConfig(true)}>⚙</button>
            )}
            <div class="clock-row">
              <WorldClocks clocks={leftClocks} format={settings.clockFormat} />
              <Clock name={settings.greetingName} format={settings.clockFormat} />
              <WorldClocks clocks={rightClocks} format={settings.clockFormat} />
            </div>
          </div>
        )}
        <SearchBar engine={settings.searchEngine} suggestProvider={settings.suggestProvider} onFilter={setFilter} />
      </div>
      {!filter && settings.showRecent && (
        <RecentRow sites={recentSites} onPin={onPinRecent} loading={recentLoading} />
      )}
      <DialGrid dials={visible} settings={settings} editing={editMode} onEdit={(d) => setEditing(d)} onDelete={removeDial} onReorder={reorderDials} onResize={resizeDial} onConfig={(d) => setConfiguring(d)} />
      <button class="add-card" onClick={() => setShowStore(true)}>{t('add')}</button>

      {editing !== undefined && (
        <CardEditor settings={settings} initial={editing ?? undefined} onSave={onSave} onClose={() => setEditing(undefined)} />
      )}
      {showSettings && (
        <Settings settings={settings} onChange={updateSettings} onClose={() => setShowSettings(false)} onRestored={() => { void reload(); }} />
      )}
      {showClockConfig && (
        <div class="modal-backdrop" onClick={() => setShowClockConfig(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('clock')}</h3>
            <ClockSettings settings={settings} onChange={updateSettings} />
            <div class="modal-actions"><button onClick={() => setShowClockConfig(false)}>{t('close')}</button></div>
          </div>
        </div>
      )}
      {showStore && (
        <Store
          onAddLink={() => { setShowStore(false); setEditing(null); }}
          onAddWidget={async (type) => { setShowStore(false); await addWidget(type); }}
          onClose={() => setShowStore(false)}
        />
      )}
      {configuring?.widget && (() => {
        const w = configuring.widget;
        const def = getWidget(w.type);
        const Editor = def?.ConfigEditor;
        return (
          <div class="modal-backdrop" onClick={() => setConfiguring(null)}>
            <div class="modal" onClick={(e) => e.stopPropagation()}>
              <h3>{def ? t(def.nameKey) : ''}</h3>
              {Editor && (
                <Editor config={w.config as never}
                  onChange={(config: never) => {
                    const updated: Dial = { ...configuring, widget: { type: w.type, config } as Dial['widget'] };
                    setConfiguring(updated);
                    void updateDial(updated);
                  }} />
              )}
              <div class="modal-actions"><button onClick={() => setConfiguring(null)}>{t('close')}</button></div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export function NewTab() {
  return <AppProvider><Board /></AppProvider>;
}
