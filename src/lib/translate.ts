export interface TranslateResult {
  text: string;
  source: string; // detected/used source language code ('' if unknown)
  via: 'device' | 'cloud' | 'none';
  status?: 'downloading' | 'unavailable';
}

interface TranslatorGlobal {
  availability(opts: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(opts: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (m: { addEventListener: (t: string, cb: (e: { loaded: number }) => void) => void }) => void;
  }): Promise<{ translate(text: string): Promise<string> }>;
}
interface DetectorGlobal {
  availability(): Promise<string>;
  create(): Promise<{ detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]> }>;
}

function translatorAPI(): TranslatorGlobal | null {
  const g = globalThis as unknown as { Translator?: TranslatorGlobal };
  return g.Translator ?? null;
}
function detectorAPI(): DetectorGlobal | null {
  const g = globalThis as unknown as { LanguageDetector?: DetectorGlobal };
  return g.LanguageDetector ?? null;
}

export async function detectLanguage(text: string): Promise<string | null> {
  const api = detectorAPI();
  if (!text.trim() || !api) return null;
  try {
    if ((await api.availability()) === 'unavailable') return null;
    const detector = await api.create();
    const results = await detector.detect(text);
    return results?.[0]?.detectedLanguage ?? null;
  } catch {
    return null;
  }
}

export async function translateOnDevice(
  text: string, source: string, target: string, onDownload?: (p: number) => void,
): Promise<string | null> {
  if (source === target) return text;
  const api = translatorAPI();
  if (!api || !source) return null;
  try {
    if ((await api.availability({ sourceLanguage: source, targetLanguage: target })) === 'unavailable') return null;
    const translator = await api.create({
      sourceLanguage: source,
      targetLanguage: target,
      monitor(m) { m.addEventListener('downloadprogress', (e) => onDownload?.(e.loaded)); },
    });
    return await translator.translate(text);
  } catch {
    return null;
  }
}

export async function translateCloud(text: string, source: string, target: string): Promise<string | null> {
  try {
    const langpair = `${source || 'autodetect'}|${target}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { responseData?: { translatedText?: string } };
    return data?.responseData?.translatedText ?? null;
  } catch {
    return null;
  }
}

export async function translate(
  text: string, target: string, opts: { cloudFallback: boolean; onDownload?: (p: number) => void },
): Promise<TranslateResult> {
  const trimmed = text.trim();
  if (!trimmed) return { text: '', source: '', via: 'none' };
  const source = (await detectLanguage(trimmed)) ?? '';
  if (source && source === target) return { text, source, via: 'device' };
  if (source) {
    const onDev = await translateOnDevice(trimmed, source, target, opts.onDownload);
    if (onDev != null) return { text: onDev, source, via: 'device' };
  }
  if (opts.cloudFallback) {
    const cloud = await translateCloud(trimmed, source, target);
    if (cloud != null) return { text: cloud, source, via: 'cloud' };
  }
  return { text: '', source, via: 'none', status: 'unavailable' };
}

export const TRANSLATE_LANGS: { code: string; label: string }[] = [
  { code: 'en', label: 'English' }, { code: 'es', label: 'Español' }, { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' }, { code: 'ru', label: 'Русский' }, { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' }, { code: 'nl', label: 'Nederlands' }, { code: 'pl', label: 'Polski' },
  { code: 'tr', label: 'Türkçe' }, { code: 'uk', label: 'Українська' }, { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' }, { code: 'zh', label: '中文' }, { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' },
];
