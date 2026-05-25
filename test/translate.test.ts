import { describe, it, expect, vi, afterEach } from 'vitest';
import { translate, detectLanguage } from '../src/lib/translate';

const g = globalThis as unknown as { Translator?: unknown; LanguageDetector?: unknown };

function stubDetector(lang: string | null) {
  g.LanguageDetector = lang == null
    ? undefined
    : { async availability() { return 'available'; },
        async create() { return { async detect() { return [{ detectedLanguage: lang, confidence: 1 }]; } }; } };
}
function stubTranslator(result: string | null) {
  g.Translator = result == null
    ? undefined
    : { async availability() { return 'available'; },
        async create() { return { async translate(t: string) { return `${result}:${t}`; } }; } };
}

afterEach(() => { g.Translator = undefined; g.LanguageDetector = undefined; vi.unstubAllGlobals(); });

describe('translate orchestrator', () => {
  it('returns empty for blank input', async () => {
    expect((await translate('   ', 'en', { cloudFallback: false })).via).toBe('none');
  });

  it('short-circuits when source equals target', async () => {
    stubDetector('en');
    const r = await translate('hello', 'en', { cloudFallback: false });
    expect(r.via).toBe('device');
    expect(r.text).toBe('hello');
  });

  it('translates on-device when available', async () => {
    stubDetector('ru');
    stubTranslator('OUT');
    const r = await translate('привет', 'en', { cloudFallback: false });
    expect(r.via).toBe('device');
    expect(r.text).toBe('OUT:привет');
    expect(r.source).toBe('ru');
  });

  it('falls back to cloud when on-device is unavailable and cloudFallback is on', async () => {
    stubDetector('ru');
    g.Translator = undefined;
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ responseData: { translatedText: 'CLOUD' } }) })));
    const r = await translate('привет', 'en', { cloudFallback: true });
    expect(r.via).toBe('cloud');
    expect(r.text).toBe('CLOUD');
  });

  it('reports unavailable when nothing works and cloud is off', async () => {
    stubDetector('ru');
    g.Translator = undefined;
    const r = await translate('привет', 'en', { cloudFallback: false });
    expect(r.via).toBe('none');
    expect(r.status).toBe('unavailable');
  });

  it('detectLanguage returns null without the API', async () => {
    g.LanguageDetector = undefined;
    expect(await detectLanguage('hi')).toBeNull();
  });
});
