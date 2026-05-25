export const SCHEMA_VERSION = 1;

export type ImageRef = 'favicon' | 'letter' | string; // any other string = key into local.images
export type SearchEngine = 'google' | 'duckduckgo' | 'bing';
export type CardSize = 'sm' | 'md' | 'lg';
export type SuggestProvider = 'off' | 'duckduckgo' | 'google';
export type Lang = 'en' | 'ru' | 'es' | 'de' | 'fr';

export type WidgetType = 'note' | 'clock' | 'translator' | 'bookmarks' | 'tabgroups';
export interface NoteConfig { text: string; }
export interface ClockConfig { timeZone: string; label: string; showGreeting: boolean; format: '24h' | '12h'; }
export interface TranslatorConfig { target: string; cloudFallback: boolean; }
export interface BookmarksConfig { folderId: string; }
export type TabGroupsConfig = Record<string, never>;
export type WidgetInstance =
  | { type: 'note'; config: NoteConfig }
  | { type: 'clock'; config: ClockConfig }
  | { type: 'translator'; config: TranslatorConfig }
  | { type: 'bookmarks'; config: BookmarksConfig }
  | { type: 'tabgroups'; config: TabGroupsConfig };

export interface Dial {
  id: string;
  url: string;
  title: string;
  imageRef: ImageRef;
  color: string; // used for the 'letter' preview mode
  order: number;
  size?: { w: number; h: number }; // grid span in cells; defaults to 1x1
  widget?: WidgetInstance;
  zone?: 'top' | 'grid'; // 'top' = the row above the search bar; default/absent = main grid
}

export interface Theme {
  id: string;
  name: string;
  builtin: boolean;
  vars: Record<string, string>; // CSS custom property name -> value
}

export interface Background {
  type: 'theme' | 'color' | 'gradient' | 'imageRef';
  value: string; // color/gradient string, or an image key in local.images, or '' for theme default
}

export interface Settings {
  schemaVersion: number;
  activeThemeId: string;
  customThemes: Theme[];
  searchEngine: SearchEngine;
  cardSize: CardSize;
  background: Background;
  useScreenshots: boolean;       // off by default; sends URLs to a 3rd party when on
  screenshotTemplate: string;    // e.g. "https://service.example/{url}"
  showRecent: boolean;
  showRecentLabel: boolean;
  showSearch: boolean;
  suggestProvider: SuggestProvider;
  language: Lang;
  onboarded: boolean;
}

export interface StoredImage {
  data: string;                  // data URL
  source: 'upload' | 'url' | 'screenshot';
  srcUrl?: string;               // original URL for 'url'/'screenshot' sources
}

export interface Snapshot {
  schemaVersion: number;
  settings: Settings;
  dials: Dial[];
  images: Record<string, StoredImage>;
}
