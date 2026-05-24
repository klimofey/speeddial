import { useEffect, useState } from 'preact/hooks';

export function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function Clock({ name }: { name: string | null }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const hello = greeting(now.getHours()) + (name ? `, ${name}` : '');
  return (
    <div class="clock">
      <div class="clock-time">{time}</div>
      <div class="clock-greeting">{hello}</div>
    </div>
  );
}
