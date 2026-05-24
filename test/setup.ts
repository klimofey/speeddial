import { vi, beforeEach } from 'vitest';

function createArea() {
  let store: Record<string, unknown> = {};
  return {
    _reset: () => { store = {}; },
    _raw: () => store,
    get: vi.fn(async (keys?: unknown) => {
      if (keys == null) return { ...store };
      if (typeof keys === 'string') return { [keys]: store[keys] };
      if (Array.isArray(keys)) return Object.fromEntries(keys.map((k) => [k, store[k as string]]));
      const defaults = keys as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(defaults)) out[k] = k in store ? store[k] : defaults[k];
      return out;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => { Object.assign(store, items); }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
    }),
    clear: vi.fn(async () => { store = {}; }),
  };
}

const sync = createArea();
const local = createArea();

(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: { sync, local, onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
  runtime: { getURL: (p: string) => 'chrome-extension://test' + p },
};

export const mockChrome = { sync, local };

beforeEach(() => { sync._reset(); local._reset(); vi.clearAllMocks(); });
