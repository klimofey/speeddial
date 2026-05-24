import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'SpeedDial',
  version: '0.1.0',
  description: 'Free, private, beautiful speed dial new tab.',
  minimum_chrome_version: '110',
  permissions: ['storage', 'unlimitedStorage', 'favicon', 'history'],
  chrome_url_overrides: { newtab: 'index.html' },
  optional_host_permissions: ['https://suggestqueries.google.com/*'],
  icons: {
    '16': 'icons/icon-16.png',
    '32': 'icons/icon-32.png',
    '48': 'icons/icon-48.png',
    '128': 'icons/icon-128.png',
  },
});
