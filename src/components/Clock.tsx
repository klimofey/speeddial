export function greeting(hour: number): 'greeting_morning' | 'greeting_afternoon' | 'greeting_evening' {
  if (hour < 12) return 'greeting_morning';
  if (hour < 18) return 'greeting_afternoon';
  return 'greeting_evening';
}
