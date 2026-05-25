import { useState, useRef } from 'preact/hooks';
import { SearchEngine, SuggestProvider } from '../lib/types';
import { t } from '../lib/i18n';
import { fetchSuggestions } from '../lib/suggest';

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
  suggestProvider: SuggestProvider;
  onFilter: (text: string) => void;
}

export function SearchBar({ engine, suggestProvider, onFilter }: Props) {
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const go = (q: string) => {
    if (q.trim()) window.location.href = searchUrl(engine, q.trim());
  };

  const onInput = (e: Event) => {
    const v = (e.target as HTMLInputElement).value;
    setValue(v);
    onFilter(v);
    setActive(-1);
    if (timer.current) clearTimeout(timer.current);
    if (suggestProvider === 'off' || !v.trim()) {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(() => {
      void fetchSuggestions(suggestProvider, v).then(setSuggestions);
    }, 150);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setActive(-1);
    }
  };

  const submit = (e: Event) => {
    e.preventDefault();
    go(active >= 0 ? suggestions[active] : value);
  };

  return (
    <form class="searchbar" onSubmit={submit} autocomplete="off">
      <input
        placeholder={t('search_placeholder')}
        value={value}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onBlur={() => { setSuggestions([]); setActive(-1); }}
      />
      {suggestions.length > 0 && (
        <ul class="suggestions">
          {suggestions.map((s, i) => (
            <li
              key={s}
              class={`suggestion${i === active ? ' active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); go(s); }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
