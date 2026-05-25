import { Settings, Theme } from './types';
import { BUILTIN_THEMES } from './defaults';

export function allThemes(custom: Theme[]): Theme[] {
  return [...BUILTIN_THEMES, ...custom];
}

// True when the OS is set to dark mode. Safe to call where matchMedia is absent (tests/SSR).
export function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(settings: Settings): Theme {
  if (settings.activeThemeId === 'system') {
    const id = systemPrefersDark() ? 'dark-neon' : 'light-minimal';
    return BUILTIN_THEMES.find((t) => t.id === id) ?? BUILTIN_THEMES[0];
  }
  const list = allThemes(settings.customThemes);
  return list.find((t) => t.id === settings.activeThemeId) ?? BUILTIN_THEMES[0];
}

// Applies the active theme's CSS variables, then overrides --bg if a custom background is set.
export function applyTheme(settings: Settings, target: HTMLElement = document.documentElement): void {
  const theme = resolveTheme(settings);
  for (const [name, value] of Object.entries(theme.vars)) {
    target.style.setProperty(name, value);
  }
  const bg = settings.background;
  if (bg.type === 'color' || bg.type === 'gradient') {
    target.style.setProperty('--bg', bg.value);
  }
  // bg.type === 'imageRef' is applied by the component (needs the resolved data URL).
}
