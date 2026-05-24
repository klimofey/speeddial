import { useState } from 'preact/hooks';
import { Settings as SettingsType, Theme, SearchEngine, CardSize, Background, SuggestProvider } from '../lib/types';
import { ThemePicker } from './ThemePicker';
import { buildSnapshot, serialize, parseSnapshot, restoreSnapshot } from '../lib/backup';
import { ensureGooglePermission } from '../lib/permissions';
import { fileToDataUrl } from '../lib/images';
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

  const onSuggestChange = async (e: Event) => {
    const v = (e.target as HTMLSelectElement).value as SuggestProvider;
    if (v === 'google') {
      const ok = await ensureGooglePermission();
      onChange({ suggestProvider: ok ? 'google' : 'duckduckgo' });
    } else {
      onChange({ suggestProvider: v });
    }
  };

  const setBackgroundType = (type: Background['type']) => {
    const value =
      type === 'color' ? '#1a1a1a'
      : type === 'gradient' ? 'linear-gradient(135deg,#6a5acd,#ec4899)'
      : '';
    onChange({ background: { type, value } });
  };

  const onBgFile = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const data = await fileToDataUrl(file);
    const ref = 'bg-' + Date.now().toString(36);
    await setImage(ref, { data, source: 'upload' });
    onChange({ background: { type: 'imageRef', value: ref } });
  };

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal settings" onClick={(e) => e.stopPropagation()}>
        <h3>Settings</h3>

        <label>Theme</label>
        <ThemePicker settings={settings} onPick={(id) => onChange({ activeThemeId: id })} onAddCustom={addCustom} />

        <label for="se-bg">Background</label>
        <select id="se-bg" value={settings.background.type}
          onChange={(e) => setBackgroundType((e.target as HTMLSelectElement).value as Background['type'])}>
          <option value="theme">Theme default</option>
          <option value="color">Solid color</option>
          <option value="gradient">Gradient</option>
          <option value="imageRef">Image</option>
        </select>
        {settings.background.type === 'color' && (
          <input type="color" aria-label="Background color" value={settings.background.value || '#000000'}
            onInput={(e) => onChange({ background: { type: 'color', value: (e.target as HTMLInputElement).value } })} />
        )}
        {settings.background.type === 'gradient' && (
          <input aria-label="Background gradient" placeholder="linear-gradient(135deg,#6a5acd,#ec4899)"
            value={settings.background.value}
            onInput={(e) => onChange({ background: { type: 'gradient', value: (e.target as HTMLInputElement).value } })} />
        )}
        {settings.background.type === 'imageRef' && (
          <input type="file" accept="image/*" aria-label="Background image" onChange={onBgFile} />
        )}

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

        <label>
          <input type="checkbox" checked={settings.showRecent}
            onChange={(e) => onChange({ showRecent: (e.target as HTMLInputElement).checked })} /> Show recent sites
        </label>

        <label for="se-suggest">Search suggestions</label>
        <select id="se-suggest" value={settings.suggestProvider} onChange={onSuggestChange}>
          <option value="off">Off</option>
          <option value="duckduckgo">DuckDuckGo</option>
          <option value="google">Google</option>
        </select>
        <p class="settings-warn">⚠ Suggestions send what you type to the chosen provider. DuckDuckGo needs no extra permission; Google asks for one.</p>

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
