import { useEffect, useState } from 'preact/hooks';
import { formatTime } from '../lib/time';
import { t } from '../lib/i18n';

export function greeting(hour: number): 'greeting_morning' | 'greeting_afternoon' | 'greeting_evening' {
  if (hour < 12) return 'greeting_morning';
  if (hour < 18) return 'greeting_afternoon';
  return 'greeting_evening';
}

export function Clock({ name, format }: { name: string | null; format: '24h' | '12h' }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = formatTime(now, { hour12: format === '12h' });
  const hello = t(greeting(now.getHours())) + (name ? `, ${name}` : '');
  return (
    <div class="clock">
      <div class="clock-time">{time}</div>
      <div class="clock-greeting">{hello}</div>
    </div>
  );
}
