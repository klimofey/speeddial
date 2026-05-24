import { Settings, Theme } from './types';
import { BUILTIN_THEMES } from './defaults';

export function allThemes(custom: Theme[]): Theme[] {
  return [...BUILTIN_THEMES, ...custom];
}

export function resolveTheme(settings: Settings): Theme {
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
