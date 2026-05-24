import { allThemes } from '../lib/themes';
import { Settings, Theme } from '../lib/types';
import { t } from '../lib/i18n';

interface Props {
  settings: Settings;
  onPick: (themeId: string) => void;
  onAddCustom: (theme: Theme) => void;
}

export function ThemePicker({ settings, onPick, onAddCustom }: Props) {
  const themes = allThemes(settings.customThemes);
  const cloneActive = () => {
    const base = themes.find((theme) => theme.id === settings.activeThemeId) ?? themes[0];
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
        {themes.map((theme) => (
          <button
            key={theme.id}
            class={`theme-swatch${theme.id === settings.activeThemeId ? ' active' : ''}`}
            style={{ background: theme.vars['--bg'] }}
            title={theme.name}
            onClick={() => onPick(theme.id)}
          >
            <span style={{ color: theme.vars['--accent'] }}>{theme.name}</span>
          </button>
        ))}
      </div>
      <button class="theme-add" onClick={cloneActive}>{t('theme_new')}</button>
    </div>
  );
}
