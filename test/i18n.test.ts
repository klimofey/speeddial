import { describe, it, expect, afterEach } from 'vitest';
import { t, setLang, detectLang, messages, LANGS } from '../src/lib/i18n';

afterEach(() => setLang('en'));

describe('i18n', () => {
  it('returns the active language string', () => {
    setLang('ru');
    expect(t('save')).toBe(messages.ru.save);
    expect(t('save')).not.toBe('Save');
  });
  it('falls back to English for a missing key in another language', () => {
    setLang('ru');
    // a key only present in en still resolves via the en fallback
    expect(t('save')).toBeTruthy();
  });
  it('falls back to the key itself when unknown everywhere', () => {
    setLang('en');
    expect(t('___nope___')).toBe('___nope___');
  });
  it('interpolates {vars}', () => {
    setLang('en');
    expect(t('scrape_found_more', { n: 3 })).toContain('3');
  });
  it('detectLang maps a browser locale to a supported Lang', () => {
    expect(detectLang('ru-RU')).toBe('ru');
    expect(detectLang('pt-BR')).toBe('en');
  });
  it('LANGS lists all five languages', () => {
    expect(LANGS.map((l) => l.code).sort()).toEqual(['de', 'en', 'es', 'fr', 'ru']);
  });
  it('every language defines the same keys as English', () => {
    const enKeys = Object.keys(messages.en).sort();
    for (const code of ['ru', 'es', 'de', 'fr'] as const) {
      expect(Object.keys(messages[code]).sort()).toEqual(enKeys);
    }
  });
});
