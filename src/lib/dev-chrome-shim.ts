export {}; // make this a module so it can be dynamically imported

// Dev-only shim: lets the new-tab page run in a plain browser (`vite` dev server /
// Playwright) where the extension's `chrome.*` APIs don't exist. It is imported
// ONLY behind `import.meta.env.DEV` in main.tsx, so Vite dead-code-eliminates it
// from the production extension bundle. Storage is in-memory (resets on reload).

type Store = Record<string, unknown>;

function area(initial: Store = {}) {
  const data: Store = { ...initial };
  return {
    async get(keys: string | string[] | null) {
      if (keys == null) return { ...data };
      const list = Array.isArray(keys) ? keys : [keys];
      const out: Store = {};
      for (const k of list) if (k in data) out[k] = data[k];
      return out;
    },
    async set(items: Store) {
      Object.assign(data, items);
    },
    async remove(keys: string | string[]) {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete data[k];
    },
  };
}

const g = globalThis as unknown as { chrome?: { storage?: unknown } };

if (typeof g.chrome === 'undefined' || !g.chrome.storage) {
  g.chrome = {
    storage: { sync: area(), local: area() },
    history: { async search() { return []; } },
    permissions: { async request() { return true; }, async contains() { return true; } },
    runtime: { getURL: (p: string) => p, lastError: undefined },
  } as never;
  // eslint-disable-next-line no-console
  console.info('[dev-chrome-shim] installed in-memory chrome.* mock');
}

// Force-override the on-device translation APIs in dev. Real Chrome (138+) exposes
// these, but the language models usually aren't downloaded in a throwaway/dev browser,
// so the real APIs would just report "unavailable". Replacing them with working stubs
// makes the Translator widget demoable under vite dev / Playwright. Dev-only — never ships.
const gg = globalThis as unknown as { Translator?: unknown; LanguageDetector?: unknown };
gg.Translator = {
  async availability() { return 'available'; },
  async create(opts: { sourceLanguage: string; targetLanguage: string }) {
    return { async translate(text: string) { return `[${opts.sourceLanguage}→${opts.targetLanguage}] ${text}`; } };
  },
};
gg.LanguageDetector = {
  async availability() { return 'available'; },
  async create() { return { async detect() { return [{ detectedLanguage: 'ru', confidence: 1 }]; } }; },
};
