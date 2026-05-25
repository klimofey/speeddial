import { Settings as SettingsType, WorldClock } from '../lib/types';
import { t } from '../lib/i18n';
import { listTimeZones, labelForZone } from '../lib/time';

interface Props {
  settings: SettingsType;
  onChange: (patch: Partial<SettingsType>) => void;
}

export function ClockSettings({ settings, onChange }: Props) {
  const addWorldClock = (tz: string) => {
    const wc: WorldClock = { id: 'wc-' + Date.now().toString(36), timeZone: tz, label: labelForZone(tz) };
    onChange({ worldClocks: [...settings.worldClocks, wc] });
  };
  const removeWorldClock = (id: string) => onChange({ worldClocks: settings.worldClocks.filter((c) => c.id !== id) });
  const setLabel = (id: string, label: string) =>
    onChange({ worldClocks: settings.worldClocks.map((c) => (c.id === id ? { ...c, label } : c)) });

  return (
    <div class="clock-settings">
      <label>
        <input type="checkbox" checked={settings.showClock}
          onChange={(e) => onChange({ showClock: (e.target as HTMLInputElement).checked })} /> {t('show_clock')}
      </label>

      <label for="cs-fmt">{t('clock_format')}</label>
      <select id="cs-fmt" value={settings.clockFormat}
        onChange={(e) => onChange({ clockFormat: (e.target as HTMLSelectElement).value as '24h' | '12h' })}>
        <option value="24h">{t('fmt_24')}</option>
        <option value="12h">{t('fmt_12')}</option>
      </select>

      <label for="cs-name">{t('greeting_name')}</label>
      <input id="cs-name" value={settings.greetingName ?? ''}
        onInput={(e) => onChange({ greetingName: (e.target as HTMLInputElement).value || null })} />

      <label for="cs-tz">{t('world_clocks')}</label>
      {settings.worldClocks.length > 0 && (
        <div class="wc-list">
          {settings.worldClocks.map((c) => (
            <div class="wc-item" key={c.id}>
              <input aria-label={`Label for ${c.timeZone}`} value={c.label}
                onInput={(e) => setLabel(c.id, (e.target as HTMLInputElement).value)} />
              <span class="wc-tz">{c.timeZone}</span>
              <button aria-label={`Remove ${c.label}`} onClick={() => removeWorldClock(c.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
      <select id="cs-tz" value="" onChange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v) addWorldClock(v); }}>
        <option value="">{t('add_tz')}</option>
        {listTimeZones().map((tz) => <option value={tz} key={tz}>{tz}</option>)}
      </select>
    </div>
  );
}
