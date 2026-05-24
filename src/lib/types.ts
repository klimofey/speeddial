export const SCHEMA_VERSION = 1;

export type ImageRef = 'favicon' | 'letter' | string; // any other string = key into local.images
export type SearchEngine = 'google' | 'duckduckgo' | 'bing';
export type CardSize = 'sm' | 'md' | 'lg';

export interface Dial {
  id: string;
  url: string;
  title: string;
  imageRef: ImageRef;
  color: string; // used for the 'letter' preview mode
  order: number;
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
  showClock: boolean;
  greetingName: string | null;
  background: Background;
  useScreenshots: boolean;       // off by default; sends URLs to a 3rd party when on
  screenshotTemplate: string;    // e.g. "https://service.example/{url}"
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
