# SpeedDial

A free, privacy-first new-tab speed dial for Chrome (Manifest V3). No ads, no
trackers, no telemetry. External requests happen only when you explicitly add an
image by URL or opt into the screenshot service.

## Features
- Drag-and-drop cards (SortableJS)
- Per-card previews: site icon, letter+color, uploaded image, or image URL
- Optional screenshot previews (off by default; warns before sending URLs out)
- Switchable + custom themes (Light Minimal, Glass Gradient, Dark Neon)
- Custom backgrounds (color, gradient, image)
- Clock, greeting, and web search (Google / DuckDuckGo / Bing)
- JSON / ZIP backup export & import

## Develop
```bash
npm install
npm run dev      # Vite dev server with HMR
npm test         # Vitest unit/component tests
npm run build    # outputs dist/
```

## Install (unpacked)
1. `npm run build`
2. Open `chrome://extensions`, enable Developer mode.
3. **Load unpacked** -> select `dist/`.

## Privacy
- Card metadata + settings: `chrome.storage.sync` (synced across your Chrome
  profile). Falls back to local storage if the sync quota is exceeded.
- Images & backgrounds: `chrome.storage.local` (stay on this device).
- No analytics. No remote code. Default Content Security Policy is not relaxed.
- Recent row: reads `chrome.history` locally to rank recently-popular sites; this data is never sent anywhere. Toggle off with "Show recent sites".
- Search suggestions: when enabled, the text you type is sent to the chosen provider (DuckDuckGo by default; Google is opt-in and asks for a host permission at the moment you switch to it). Set suggestions to "Off" to disable.
