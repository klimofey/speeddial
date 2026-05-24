import { useState } from 'preact/hooks';
import { SearchEngine } from '../lib/types';

const ENGINES: Record<SearchEngine, (q: string) => string> = {
  google: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  duckduckgo: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
  bing: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
};

export function searchUrl(engine: SearchEngine, query: string): string {
  return ENGINES[engine](query);
}

interface Props {
  engine: SearchEngine;
  onFilter: (text: string) => void;
}

export function SearchBar({ engine, onFilter }: Props) {
  const [value, setValue] = useState('');
  const submit = (e: Event) => {
    e.preventDefault();
    if (value.trim()) window.location.href = searchUrl(engine, value.trim());
  };
  return (
    <form class="searchbar" onSubmit={submit}>
      <input
        placeholder="Search the web or filter your cards…"
        value={value}
        onInput={(e) => { const v = (e.target as HTMLInputElement).value; setValue(v); onFilter(v); }}
      />
    </form>
  );
}
