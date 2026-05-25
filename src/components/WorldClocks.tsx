import { useEffect, useState } from 'preact/hooks';
import { WorldClock } from '../lib/types';
import { formatTime } from '../lib/time';

interface Props {
  clocks: WorldClock[];
  format: '24h' | '12h';
}

export function WorldClocks({ clocks, format }: Props) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!clocks.length) return null;

  const renderTime = (tz: string) => {
    try {
      return formatTime(now, { timeZone: tz, hour12: format === '12h' });
    } catch {
      return '--:--';
    }
  };

  return (
    <div class="world-clocks">
      {clocks.map((c) => (
        <div class="world-clock" key={c.id}>
          <span class="world-clock-time">{renderTime(c.timeZone)}</span>
          <span class="world-clock-label">{c.label}</span>
        </div>
      ))}
    </div>
  );
}
