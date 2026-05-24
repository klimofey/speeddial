import { createContext } from 'preact';
import { useContext, useEffect, useState, useCallback } from 'preact/hooks';
import { ComponentChildren } from 'preact';
import { Dial, Settings } from '../lib/types';
import * as storage from '../lib/storage';
import { DEFAULT_SETTINGS } from '../lib/defaults';

interface AppContextValue {
  ready: boolean;
  dials: Dial[];
  settings: Settings;
  addDial: (input: { url: string; title: string }) => Promise<void>;
  updateDial: (dial: Dial) => Promise<void>;
  removeDial: (id: string) => Promise<void>;
  reorderDials: (orderedIds: string[]) => Promise<void>;
  resizeDial: (id: string, size: { w: number; h: number }) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  reload: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function uid(): string {
  return 'd-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function AppProvider({ children }: { children: ComponentChildren }) {
  const [ready, setReady] = useState(false);
  const [dials, setDials] = useState<Dial[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const reload = useCallback(async () => {
    setDials(await storage.getDials());
    setSettings(await storage.getSettings());
    setReady(true);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const persistDials = useCallback(async (next: Dial[]) => {
    setDials(next);
    await storage.setDials(next);
  }, []);

  const addDial = useCallback(async (input: { url: string; title: string }) => {
    const next = [
      ...dials,
      { id: uid(), url: input.url, title: input.title, imageRef: 'favicon' as const, color: '', order: dials.length, size: { w: 1, h: 1 } },
    ];
    await persistDials(next);
  }, [dials, persistDials]);

  const updateDial = useCallback(async (dial: Dial) => {
    await persistDials(dials.map((d) => (d.id === dial.id ? dial : d)));
  }, [dials, persistDials]);

  const removeDial = useCallback(async (id: string) => {
    await persistDials(dials.filter((d) => d.id !== id).map((d, i) => ({ ...d, order: i })));
  }, [dials, persistDials]);

  const reorderDials = useCallback(async (orderedIds: string[]) => {
    const byId = new Map(dials.map((d) => [d.id, d]));
    const next = orderedIds.map((id, i) => ({ ...byId.get(id)!, order: i }));
    await persistDials(next);
  }, [dials, persistDials]);

  const resizeDial = useCallback(async (id: string, size: { w: number; h: number }) => {
    await persistDials(dials.map((d) => (d.id === id ? { ...d, size } : d)));
  }, [dials, persistDials]);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await storage.setSettings(next);
  }, [settings]);

  const value: AppContextValue = {
    ready, dials, settings, addDial, updateDial, removeDial, reorderDials, resizeDial, updateSettings, reload,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
