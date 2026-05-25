import { useState } from 'preact/hooks';
import { Settings as SettingsType, Theme, SearchEngine, CardSize, Background, SuggestProvider, Lang } from '../lib/types';
import { t, LANGS } from '../lib/i18n';
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
        <h3>{t('settings_title')}</h3>

        <label>{t('theme')}</label>
        <ThemePicker settings={settings} onPick={(id) => onChange({ activeThemeId: id })} onAddCustom={addCustom} />

        <label for="se-bg">{t('background')}</label>
        <select id="se-bg" value={settings.background.type}
          onChange={(e) => setBackgroundType((e.target as HTMLSelectElement).value as Background['type'])}>
          <option value="theme">{t('bg_theme')}</option>
          <option value="color">{t('bg_color')}</option>
          <option value="gradient">{t('bg_gradient')}</option>
          <option value="imageRef">{t('bg_image')}</option>
        </select>
        {settings.background.type === 'color' && (
          <input type="color" aria-label={t('aria_bg_color')} value={settings.background.value || '#000000'}
            onInput={(e) => onChange({ background: { type: 'color', value: (e.target as HTMLInputElement).value } })} />
        )}
        {settings.background.type === 'gradient' && (
          <input aria-label={t('aria_bg_gradient')} placeholder="linear-gradient(135deg,#6a5acd,#ec4899)"
            value={settings.background.value}
            onInput={(e) => onChange({ background: { type: 'gradient', value: (e.target as HTMLInputElement).value } })} />
        )}
        {settings.background.type === 'imageRef' && (
          <input type="file" accept="image/*" aria-label={t('aria_bg_image')} onChange={onBgFile} />
        )}

        <label for="se-engine">{t('search_engine')}</label>
        <select id="se-engine" value={settings.searchEngine}
          onChange={(e) => onChange({ searchEngine: (e.target as HTMLSelectElement).value as SearchEngine })}>
          <option value="google">Google</option>
          <option value="duckduckgo">DuckDuckGo</option>
          <option value="bing">Bing</option>
        </select>

        <label for="se-size">{t('card_size')}</label>
        <select id="se-size" value={settings.cardSize}
          onChange={(e) => onChange({ cardSize: (e.target as HTMLSelectElement).value as CardSize })}>
          <option value="sm">{t('size_sm')}</option>
          <option value="md">{t('size_md')}</option>
          <option value="lg">{t('size_lg')}</option>
        </select>

        <label for="se-clock-format">{t('clock_format')}</label>
        <select id="se-clock-format" value={settings.clockFormat}
          onChange={(e) => onChange({ clockFormat: (e.target as HTMLSelectElement).value as SettingsType['clockFormat'] })}>
          <option value="24h">{t('fmt_24')}</option>
          <option value="12h">{t('fmt_12')}</option>
        </select>

        <label>
          <input type="checkbox" checked={settings.useScreenshots}
            onChange={(e) => onChange({ useScreenshots: (e.target as HTMLInputElement).checked })} />
          {t('screenshots')}
        </label>
        <p class="settings-warn">{t('screenshots_warn')}</p>
        {settings.useScreenshots && (
          <input aria-label={t('aria_screenshot_tmpl')} placeholder="https://service.example/{url}"
            value={settings.screenshotTemplate}
            onInput={(e) => onChange({ screenshotTemplate: (e.target as HTMLInputElement).value })} />
        )}

        <label>
          <input type="checkbox" checked={settings.showRecent}
            onChange={(e) => onChange({ showRecent: (e.target as HTMLInputElement).checked })} /> {t('show_recent')}
        </label>

        <label for="se-suggest">{t('suggestions')}</label>
        <select id="se-suggest" value={settings.suggestProvider} onChange={onSuggestChange}>
          <option value="off">{t('sugg_off')}</option>
          <option value="duckduckgo">DuckDuckGo</option>
          <option value="google">Google</option>
        </select>
        <p class="settings-warn">{t('sugg_warn')}</p>

        <label for="se-lang">{t('language')}</label>
        <select id="se-lang" value={settings.language}
          onChange={(e) => onChange({ language: (e.target as HTMLSelectElement).value as Lang })}>
          {LANGS.map((l) => <option value={l.code} key={l.code}>{l.label}</option>)}
        </select>

        <label>{t('backup')}</label>
        <div class="settings-backup">
          <button onClick={doExport}>{t('export')}</button>
          <label class="import-btn">{t('import')}<input type="file" accept=".json,.zip" hidden onChange={doImport} /></label>
        </div>
        {importMsg && <p class="settings-msg">{importMsg}</p>}

        <div class="modal-actions"><button onClick={onClose}>{t('close')}</button></div>
      </div>
    </div>
  );
}
