import { SuggestProvider } from './types';

const ENDPOINTS: Record<'duckduckgo' | 'google', (q: string) => string> = {
  duckduckgo: (q) => `https://duckduckgo.com/ac/?type=list&q=${encodeURIComponent(q)}`,
  google: (q) => `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`,
};

// Both providers return the OpenSearch shape: [query, [suggestion, ...]].
export async function fetchSuggestions(provider: SuggestProvider, query: string): Promise<string[]> {
  const q = query.trim();
  if (provider === 'off' || !q) return [];
  try {
    const res = await fetch(ENDPOINTS[provider](q));
    if (!res.ok) return [];
    const data: unknown = await res.json();
    const list = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
    return list.filter((s): s is string => typeof s === 'string').slice(0, 8);
  } catch {
    return [];
  }
}
