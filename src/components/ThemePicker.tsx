import { allThemes } from '../lib/themes';
import { Settings, Theme } from '../lib/types';

interface Props {
  settings: Settings;
  onPick: (themeId: string) => void;
  onAddCustom: (theme: Theme) => void;
}

export function ThemePicker({ settings, onPick, onAddCustom }: Props) {
  const themes = allThemes(settings.customThemes);
  const cloneActive = () => {
    const base = themes.find((t) => t.id === settings.activeThemeId) ?? themes[0];
    const clone: Theme = {
      id: 'custom-' + Date.now().toString(36),
      name: base.name + ' (copy)',
      builtin: false,
      vars: { ...base.vars },
    };
    onAddCustom(clone);
  };
  return (
    <div class="theme-picker">
      <div class="theme-swatches">
        <button
          class={`theme-swatch${settings.activeThemeId === 'system' ? ' active' : ''}`}
          style={{ background: 'linear-gradient(135deg,#f4f5f7 0 50%,#0d1117 50% 100%)' }}
          title="System (follows your OS appearance)"
          onClick={() => onPick('system')}
        >
          <span style={{ color: '#888' }}>System</span>
        </button>
        {themes.map((t) => (
          <button
            key={t.id}
            class={`theme-swatch${t.id === settings.activeThemeId ? ' active' : ''}`}
            style={{ background: t.vars['--bg'] }}
            title={t.name}
            onClick={() => onPick(t.id)}
          >
            <span style={{ color: t.vars['--accent'] }}>{t.name}</span>
          </button>
        ))}
      </div>
      <button class="theme-add" onClick={cloneActive}>+ New theme from current</button>
    </div>
  );
}
