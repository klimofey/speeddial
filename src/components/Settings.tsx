import { useState } from 'preact/hooks';
import { Settings as SettingsType, Theme, SearchEngine, CardSize } from '../lib/types';
import { ThemePicker } from './ThemePicker';
import { buildSnapshot, serialize, parseSnapshot, restoreSnapshot } from '../lib/backup';

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
