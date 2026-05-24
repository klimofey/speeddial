import { describe, it, expect } from 'vitest';
import { resolveTheme, applyTheme, allThemes } from '../src/lib/themes';
import { DEFAULT_SETTINGS, BUILTIN_THEMES } from '../src/lib/defaults';
import { Theme } from '../src/lib/types';

const custom: Theme = { id: 'mine', name: 'Mine', builtin: false, vars: { '--bg': '#123456' } };

describe('themes', () => {
  it('lists builtin + custom themes', () => {
    const list = allThemes([custom]);
    expect(list).toHaveLength(BUILTIN_THEMES.length + 1);
    expect(list.find((t) => t.id === 'mine')).toBeDefined();
  });

  it('resolves the active builtin theme', () => {
    const t = resolveTheme({ ...DEFAULT_SETTINGS, activeThemeId: 'dark-neon' });
    expect(t.id).toBe('dark-neon');
  });

  it('resolves a custom theme', () => {
    const t = resolveTheme({ ...DEFAULT_SETTINGS, activeThemeId: 'mine', customThemes: [custom] });
    expect(t.id).toBe('mine');
  });

  it('falls back to the first builtin when active id is unknown', () => {
    const t = resolveTheme({ ...DEFAULT_SETTINGS, activeThemeId: 'nope' });
    expect(t.id).toBe(BUILTIN_THEMES[0].id);
  });

  it('applies theme vars to a target element', () => {
    const el = document.createElement('div');
    applyTheme({ ...DEFAULT_SETTINGS, activeThemeId: 'dark-neon' }, el);
    expect(el.style.getPropertyValue('--bg')).toBe('#0d1117');
  });
});
