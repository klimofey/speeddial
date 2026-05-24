import { Settings, Theme, SCHEMA_VERSION } from './types';

export const BUILTIN_THEMES: Theme[] = [
  {
    id: 'light-minimal', name: 'Light Minimal', builtin: true,
    vars: {
      '--bg': '#f4f5f7', '--fg': '#1a1a1a', '--card-bg': '#ffffff',
      '--card-fg': '#1a1a1a', '--accent': '#4285f4', '--muted': '#8a8f98',
      '--radius': '14px', '--card-shadow': '0 2px 10px rgba(0,0,0,.08)',
      '--card-blur': 'none', '--card-border': '1px solid transparent',
      '--search-bg': '#ffffff',
    },
  },
  {
    id: 'glass-gradient', name: 'Glass Gradient', builtin: true,
    vars: {
      '--bg': 'linear-gradient(135deg,#6a5acd 0%,#ec4899 55%,#f59e0b 100%)',
      '--fg': '#ffffff', '--card-bg': 'rgba(255,255,255,.16)',
      '--card-fg': '#ffffff', '--accent': '#ffffff', '--muted': 'rgba(255,255,255,.7)',
      '--radius': '16px', '--card-shadow': '0 4px 20px rgba(0,0,0,.15)',
      '--card-blur': 'blur(8px)', '--card-border': '1px solid rgba(255,255,255,.28)',
      '--search-bg': 'rgba(255,255,255,.18)',
    },
  },
  {
    id: 'dark-neon', name: 'Dark Neon', builtin: true,
    vars: {
      '--bg': '#0d1117', '--fg': '#e6edf3', '--card-bg': '#161b22',
      '--card-fg': '#ffffff', '--accent': '#58a6ff', '--muted': '#7d8590',
      '--radius': '14px', '--card-shadow': '0 2px 14px rgba(0,0,0,.5)',
      '--card-blur': 'none', '--card-border': '1px solid #30363d',
      '--search-bg': '#161b22',
    },
  },
];

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: SCHEMA_VERSION,
  activeThemeId: 'system',
  customThemes: [],
  searchEngine: 'google',
  cardSize: 'md',
  showClock: true,
  greetingName: null,
  background: { type: 'theme', value: '' },
  useScreenshots: false,
  screenshotTemplate: '',
};
