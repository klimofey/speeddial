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
import { WorldClocks } from './WorldClocks';
import { getRecentSites, RecentSite } from '../lib/recent';
import { RecentRow } from './RecentRow';

function Board() {
  const { ready, dials, settings, addDial, updateDial, removeDial, reorderDials, updateSettings, reload } = useApp();
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<Dial | null | undefined>(undefined); // undefined=closed, null=new
  const [showSettings, setShowSettings] = useState(false);
  const [recentSites, setRecentSites] = useState<RecentSite[]>([]);

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

  // Load recent sites (excluding already-pinned) when enabled.
  useEffect(() => {
    if (!ready || !settings.showRecent) { setRecentSites([]); return; }
    void getRecentSites({ excludeUrls: dials.map((d) => d.url) }).then(setRecentSites);
  }, [ready, settings.showRecent, dials]);

  if (!ready) return null;

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
      <button class="settings-gear" aria-label="Open settings" onClick={() => setShowSettings(true)}>⚙</button>
      <div class="header">
        {settings.showClock && (
          <>
            <Clock name={settings.greetingName} format={settings.clockFormat} />
            <WorldClocks clocks={settings.worldClocks} format={settings.clockFormat} />
          </>
        )}
        <SearchBar engine={settings.searchEngine} suggestProvider={settings.suggestProvider} onFilter={setFilter} />
      </div>
      {!filter && <RecentRow sites={recentSites} onPin={onPinRecent} />}
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
