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

const history = { search: vi.fn(async () => [] as Array<{ url?: string; title?: string; lastVisitTime?: number; visitCount?: number }>) };
const permissions = { request: vi.fn(async () => true), contains: vi.fn(async () => false) };

type UpdateListener = (id: number, info: { status?: string }) => void;
const tabUpdateListeners: UpdateListener[] = [];
const tabs = {
  create: vi.fn(async (_opts: unknown) => ({ id: 1 }) as { id?: number }),
  remove: vi.fn(async (_id: number) => {}),
  onUpdated: {
    addListener: vi.fn((fn: UpdateListener) => { tabUpdateListeners.push(fn); }),
    removeListener: vi.fn((fn: UpdateListener) => {
      const i = tabUpdateListeners.indexOf(fn);
      if (i >= 0) tabUpdateListeners.splice(i, 1);
    }),
    _emit: (id: number, info: { status?: string }) => { tabUpdateListeners.slice().forEach((l) => l(id, info)); },
  },
};
const scripting = { executeScript: vi.fn(async () => [{ result: [] as string[] }]) };

(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: { sync, local, onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
  runtime: { getURL: (p: string) => 'chrome-extension://test' + p },
  history,
  permissions,
  tabs,
  scripting,
};

export const mockChrome = { sync, local, history, permissions, tabs, scripting };

beforeEach(() => { sync._reset(); local._reset(); tabUpdateListeners.length = 0; vi.clearAllMocks(); });

// jsdom in this version ships a Blob without text()/arrayBuffer(); polyfill them
// for tests that serialize/parse Blobs. Real browsers provide these natively.
if (typeof Blob !== 'undefined') {
  if (typeof Blob.prototype.text !== 'function') {
    Blob.prototype.text = function (): Promise<string> {
      return new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsText(this as unknown as Blob);
      });
    };
  }
  if (typeof Blob.prototype.arrayBuffer !== 'function') {
    Blob.prototype.arrayBuffer = function (): Promise<ArrayBuffer> {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as ArrayBuffer);
        r.onerror = () => reject(r.error);
        r.readAsArrayBuffer(this as unknown as Blob);
      });
    };
  }
}
