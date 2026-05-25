import { useState } from 'preact/hooks';
import { Dial, Settings, ImageRef } from '../lib/types';
import { fileToDataUrl, cacheImageFromUrl, urlToDataUrl } from '../lib/images';
import { removeBackground } from '../lib/bgremove';
import { setImage } from '../lib/storage';
import { colorForKey } from '../lib/color';
import { ensureOriginPermission, hasOriginPermission } from '../lib/permissions';
import { scrapeImages, iconSources } from '../lib/metascrape';
import { scrapeRendered } from '../lib/renderscrape';
import { CardThumb } from './CardThumb';
import { t } from '../lib/i18n';

interface Props {
  settings: Settings;
  initial?: Dial;
  onSave: (dial: Omit<Dial, 'order'> & { order?: number }) => void;
  onClose: () => void;
}

type Mode = 'favicon' | 'letter' | 'upload' | 'url' | 'screenshot';

function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return v;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export function CardEditor({ settings, initial, onSave, onClose }: Props) {
  const [url, setUrl] = useState(initial?.url ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [mode, setMode] = useState<Mode>(
    initial && !['favicon', 'letter', 'screenshot'].includes(initial.imageRef) ? 'upload' : ((initial?.imageRef as Mode) ?? 'favicon'),
  );
  const [imageUrl, setImageUrl] = useState('');
  const [uploadRef, setUploadRef] = useState<string | null>(
    initial && !['favicon', 'letter', 'screenshot'].includes(initial.imageRef) ? initial.imageRef : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [scrapeMsg, setScrapeMsg] = useState('');
  const [scrapeStep, setScrapeStep] = useState<'idle' | 'need-perm' | 'searching' | 'denied'>('idle');
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selectedUrl, setSelectedUrl] = useState('');

  const canSave = url.trim().length > 0 && !busy;

  const onFile = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    setBusy(true);
    const data = await fileToDataUrl(file);
    const ref = 'up-' + Date.now().toString(36);
    await setImage(ref, { data, source: 'upload' });
    setUploadRef(ref);
    setBusy(false);
  };

  const mergeUnique = (base: string[], more: string[]) => {
    const out = [...base];
    for (const u of more) if (!out.includes(u)) out.push(u);
    return out;
  };

  const doScrape = async (base: string[]) => {
    setScrapeStep('searching');
    setScrapeMsg(t('scrape_searching'));
    setBusy(true);
    // Static HTML first (instant), then the JS-rendered DOM (opens a background tab)
    // to catch SPA logos the static fetch can't see. Merge the union.
    const imgs = await scrapeImages(normalizeUrl(url));
    let merged = mergeUnique(base, imgs);
    setCandidates(merged);
    const rendered = await scrapeRendered(normalizeUrl(url));
    merged = mergeUnique(merged, rendered);
    setCandidates(merged);
    setBusy(false);
    setScrapeStep('idle');
    const extra = merged.length - base.length;
    setScrapeMsg(extra ? t('scrape_found_more', { n: extra }) : t('scrape_no_extra'));
  };

  const removeBg = async () => {
    if (!selectedUrl) return;
    setBusy(true);
    setScrapeMsg('');
    try {
      // Reading pixels requires fetching the image bytes; cross-origin fetch needs host
      // permission for the candidate's origin (e.g. www.google.com for an s2 favicon),
      // otherwise it's blocked by CORS. data: candidates need nothing.
      if (!selectedUrl.startsWith('data:') && !(await ensureOriginPermission(selectedUrl))) {
        setScrapeMsg(t('bg_remove_failed'));
        setBusy(false);
        return;
      }
      const dataUrl = await urlToDataUrl(selectedUrl);
      const out = await removeBackground(dataUrl);
      const ref = 'cut-' + Date.now().toString(36);
      await setImage(ref, { data: out, source: 'upload' });
      setUploadRef(ref);
      setMode('upload');
      setSelectedUrl(out);
      setScrapeMsg(t('bg_removed'));
    } catch {
      setScrapeMsg(t('bg_remove_failed'));
    } finally {
      setBusy(false);
    }
  };

  const selectCandidate = async (imgUrl: string) => {
    const ref = 'meta-' + Date.now().toString(36);
    await setImage(ref, { data: imgUrl, source: 'url', srcUrl: imgUrl });
    setUploadRef(ref);
    setMode('upload');
    setSelectedUrl(imgUrl);
    setScrapeMsg(t('scrape_selected'));
  };

  const findBetterImage = async () => {
    setScrapeMsg('');
    setBusy(true);
    const icons = iconSources(normalizeUrl(url));
    setCandidates(icons);
    const granted = await hasOriginPermission(normalizeUrl(url));
    setBusy(false);
    if (granted) { await doScrape(icons); return; }
    setScrapeStep('need-perm');
    setScrapeMsg(t('scrape_pick_or_allow'));
  };

  const allowAccess = async () => {
    setBusy(true);
    const granted = await ensureOriginPermission(normalizeUrl(url));
    setBusy(false);
    if (granted) { await doScrape(candidates); return; }
    setScrapeStep('denied');
    setScrapeMsg(t('scrape_denied'));
  };

  // Returns ImageRef synchronously for simple modes; returns a Promise for async modes.
  const resolveImageRef = (): ImageRef | Promise<ImageRef> => {
    if (mode === 'favicon' || mode === 'letter' || mode === 'screenshot') return mode;
    if (mode === 'upload') return uploadRef ?? 'favicon';
    // mode === 'url'
    if (imageUrl.trim()) return cacheImageFromUrl(imageUrl.trim());
    return 'favicon';
  };

  const doSave = (imageRef: ImageRef) => {
    const finalUrl = normalizeUrl(url);
    // WYSIWYG: an empty title stays empty (the card shows no label), rather than
    // falling back to the URL host.
    const finalTitle = title.trim();
    onSave({
      id: initial?.id ?? '',
      url: finalUrl,
      title: finalTitle,
      imageRef,
      color: initial?.color || colorForKey(finalUrl),
      order: initial?.order,
    });
    setBusy(false);
  };

  const save = () => {
    setBusy(true);
    setError('');
    const ref = resolveImageRef();
    if (typeof ref === 'string') {
      doSave(ref);
    } else {
      ref.then(doSave).catch(() => {
        setBusy(false);
        setError('Could not load that image URL. Check the link and try again.');
      });
    }
  };

  const previewImageRef =
    mode === 'upload' && uploadRef ? uploadRef
    : mode === 'url' ? 'favicon'
    : mode;
  const previewUrl = normalizeUrl(url) || 'https://example.com';
  const previewDial: Dial = {
    id: 'preview', url: previewUrl, title: title || 'preview',
    imageRef: previewImageRef, color: initial?.color || colorForKey(previewUrl), order: 0,
  };

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{initial ? t('edit_card') : t('add_card_title')}</h3>

        <div class="ce-preview">
          {mode === 'url' && imageUrl.trim()
            ? <img src={imageUrl} alt="" />
            : <CardThumb dial={previewDial} settings={settings} />}
        </div>

        <label for="ce-url">{t('url')}</label>
        <input id="ce-url" value={url} onInput={(e) => setUrl((e.target as HTMLInputElement).value)} placeholder="https://example.com" />

        <label for="ce-title">{t('title')}</label>
        <input id="ce-title" value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} placeholder={t('ph_example')} />

        <label for="ce-mode">{t('preview')}</label>
        <select id="ce-mode" value={mode} onChange={(e) => setMode((e.target as HTMLSelectElement).value as Mode)}>
          <option value="favicon">{t('mode_favicon')}</option>
          <option value="letter">{t('mode_letter')}</option>
          <option value="upload">{t('mode_upload')}</option>
          <option value="url">{t('mode_url')}</option>
          {settings.useScreenshots && <option value="screenshot">{t('mode_screenshot')}</option>}
        </select>

        {url.trim() && (
          <div class="ce-find-row">
            <button type="button" class="ce-find" onClick={findBetterImage} disabled={busy}>{t('find_better')}</button>
            {(scrapeStep === 'need-perm' || scrapeStep === 'denied') && (
              <button type="button" class="ce-find" onClick={allowAccess} disabled={busy}>{t('allow_access')}</button>
            )}
          </div>
        )}
        {scrapeMsg && <p class="settings-msg">{scrapeMsg}</p>}
        {candidates.length > 0 && (
          <div class="ce-candidates">
            {candidates.map((c) => (
              <button
                type="button"
                key={c}
                class={`ce-candidate${c === selectedUrl ? ' selected' : ''}`}
                onClick={() => selectCandidate(c)}
              >
                <img src={c} alt="" onError={(e) => {
                  const btn = (e.currentTarget as HTMLElement).parentElement as HTMLElement | null;
                  if (btn) btn.style.display = 'none';
                }} />
              </button>
            ))}
          </div>
        )}
        {selectedUrl && (
          <button type="button" class="ce-find ce-removebg" onClick={removeBg} disabled={busy}>{t('remove_bg')}</button>
        )}
        {mode === 'upload' && <input type="file" accept="image/*" aria-label={t('mode_upload')} onChange={onFile} />}
        {mode === 'url' && (
          <input aria-label={t('mode_url')} value={imageUrl} placeholder="https://.../image.png"
            onInput={(e) => setImageUrl((e.target as HTMLInputElement).value)} />
        )}

        {error && <p class="ce-error">{error}</p>}
        <div class="modal-actions">
          <button onClick={onClose}>{t('cancel')}</button>
          <button disabled={!canSave} onClick={save}>{t('save')}</button>
        </div>
      </div>
    </div>
  );
}
