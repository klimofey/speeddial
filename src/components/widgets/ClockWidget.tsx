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
        <option value="">Local</option>
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
