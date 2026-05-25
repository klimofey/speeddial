# Translator widget (Part 3) — design

**Date:** 2026-05-25
**Status:** approved
**Builds on:** the widget system + Store (Part 2). A translator is just another registry entry.
**Migration:** none.

## Goal

A Translator widget tile: type text, it auto-detects the source language and shows a
translation in a chosen target language. Privacy-first: translate **on-device** via the
Chrome Translator/LanguageDetector APIs (Chrome 138+) with **no network**; only if those
are unavailable AND the user opts in does it fall back to a free cloud API (MyMemory).

## 1. Model — `src/lib/types.ts`
- `WidgetType` gains `'translator'`.
- `TranslatorConfig { target: string; cloudFallback: boolean }` (source is auto-detected).
- `WidgetInstance` gains `| { type: 'translator'; config: TranslatorConfig }`.

## 2. Engine — `src/lib/translate.ts`
- Feature-detect `self.Translator` / `self.LanguageDetector` (absent in non-Chrome/jsdom).
- `detectLanguage(text): Promise<string|null>` — LanguageDetector; null on failure.
- `translateOnDevice(text, src, tgt, onDownload?): Promise<string|null>` — Translator;
  `availability()` gate, `create({sourceLanguage, targetLanguage, monitor})` with a
  `downloadprogress` listener; null if the pair is unavailable.
- `translateCloud(text, src, tgt): Promise<string|null>` — MyMemory GET
  `api.mymemory.translated.net/get?q=…&langpair=src|tgt`; reads `responseData.translatedText`.
- `translate(text, target, { cloudFallback, onDownload? }): Promise<TranslateResult>` —
  orchestrator: trim → detect source → if source===target return as-is → try on-device →
  else if `cloudFallback` try cloud → else `{ via:'none', status:'unavailable' }`.
  `TranslateResult { text; source; via:'device'|'cloud'|'none'; status?:'downloading'|'unavailable' }`.
- `TRANSLATE_LANGS: {code,label}[]` — ~16 common languages.

## 3. Privacy / manifest / permissions
- On-device path: no network, no permission.
- `manifest.config.ts`: add `https://api.mymemory.translated.net/*` to `optional_host_permissions`.
- `src/lib/permissions.ts`: `MYMEMORY_ORIGIN` + `ensureMyMemoryPermission()` (request/contains).
- Cloud is used ONLY when `cloudFallback` is true; the config checkbox requests the host
  permission on enable and stores `cloudFallback = granted`.

## 4. Widget UI — `src/components/widgets/TranslatorWidget.tsx`
- `TranslatorRender({config})`: a `<textarea>` input (debounced ~500 ms) → a result area
  showing detected-source → target (with a ☁ marker when via cloud), the translated text,
  and a status line (`translating…` / `downloading model NN%` / `translator_unavailable`).
  Input text is ephemeral (component state), not persisted.
- `TranslatorConfigEditor({config,onChange})`: target-language `<select>` (TRANSLATE_LANGS)
  + a "cloud fallback" checkbox that calls `ensureMyMemoryPermission()` on enable.

## 5. Registry / Store
- `registry.tsx`: translator entry — icon `🌐`, `nameKey:'widget_translator'`,
  `defaultSize {w:2,h:2}`, `defaultConfig { target:'en', cloudFallback:false }`.
- It appears in the Store automatically (Store maps `WIDGETS`); Weather stays "coming soon".

## 6. i18n
New keys in all five dicts: `widget_translator, translate_placeholder, translate_to,
detected, translating, downloading_model, translator_unavailable, cloud_fallback,
cloud_fallback_warn`.

## 7. Dev harness
`src/lib/dev-chrome-shim.ts`: add stub globals `Translator` (availability→'available',
create→{translate: echo}) and `LanguageDetector` (detect→[{detectedLanguage:'en'}]) so the
widget is exercisable under `vite` dev / Playwright.

## 8. Testing
- `translate.ts`: orchestrator with mocked `Translator`/`LanguageDetector`/`fetch` —
  on-device path, cloud fallback path, unavailable path, same-language short-circuit,
  empty input.
- `TranslatorWidget`: renders input; debounced translate populates output (with fake timers
  + mocked engine); config editor emits target change; cloud checkbox calls the permission
  helper.
- `registry`: translator listed with 2×2 default; Store shows it.
- i18n parity (existing test) covers the new keys across all five dicts.

## 9. Out of scope
- Streaming translation, TTS, copy button, history of translations.
- Choosing the cloud provider (MyMemory only).
- Per-breakpoint layouts.
