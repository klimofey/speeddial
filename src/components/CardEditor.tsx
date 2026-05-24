import { useState } from 'preact/hooks';
import { Dial, Settings, ImageRef } from '../lib/types';
import { fileToDataUrl, cacheImageFromUrl } from '../lib/images';
import { setImage } from '../lib/storage';
import { colorForKey } from '../lib/color';
import { ensureOriginPermission, hasOriginPermission } from '../lib/permissions';
import { scrapeImages, iconSources } from '../lib/metascrape';
import { CardThumb } from './CardThumb';

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
    setScrapeMsg('Scanning the page…');
    setBusy(true);
    const imgs = await scrapeImages(normalizeUrl(url));
    setBusy(false);
    setScrapeStep('idle');
    setCandidates(mergeUnique(base, imgs));
    setScrapeMsg(imgs.length ? `Found ${imgs.length} more on the page — pick one.` : 'No extra images on the page.');
  };

  const selectCandidate = async (imgUrl: string) => {
    const ref = 'meta-' + Date.now().toString(36);
    await setImage(ref, { data: imgUrl, source: 'url', srcUrl: imgUrl });
    setUploadRef(ref);
    setMode('upload');
    setSelectedUrl(imgUrl);
    setScrapeMsg('Selected ✓');
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
    setScrapeMsg('Pick an icon, or "Allow access" to scan the page for more.');
  };

  const allowAccess = async () => {
    setBusy(true);
    const granted = await ensureOriginPermission(normalizeUrl(url));
    setBusy(false);
    if (granted) { await doScrape(candidates); return; }
    setScrapeStep('denied');
    setScrapeMsg('Access denied. Click "Allow access" to try again, or grant it manually in chrome://extensions → SpeedDial → Details → Site access.');
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
    const finalTitle = title.trim() || finalUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
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
        <h3>{initial ? 'Edit card' : 'Add card'}</h3>

        <div class="ce-preview">
          {mode === 'url' && imageUrl.trim()
            ? <img src={imageUrl} alt="" />
            : <CardThumb dial={previewDial} settings={settings} />}
        </div>

        <label for="ce-url">URL</label>
        <input id="ce-url" value={url} onInput={(e) => setUrl((e.target as HTMLInputElement).value)} placeholder="https://example.com" />

        <label for="ce-title">Title</label>
        <input id="ce-title" value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} placeholder="Example" />

        <label for="ce-mode">Preview</label>
        <select id="ce-mode" value={mode} onChange={(e) => setMode((e.target as HTMLSelectElement).value as Mode)}>
          <option value="favicon">Site icon</option>
          <option value="letter">Letter + color</option>
          <option value="upload">Upload image</option>
          <option value="url">Image URL</option>
          {settings.useScreenshots && <option value="screenshot">Screenshot</option>}
        </select>

        {url.trim() && (
          <div class="ce-find-row">
            <button type="button" class="ce-find" onClick={findBetterImage} disabled={busy}>Find better image</button>
            {(scrapeStep === 'need-perm' || scrapeStep === 'denied') && (
              <button type="button" class="ce-find" onClick={allowAccess} disabled={busy}>Allow access</button>
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
        {mode === 'upload' && <input type="file" accept="image/*" aria-label="Upload image" onChange={onFile} />}
        {mode === 'url' && (
          <input aria-label="Image URL" value={imageUrl} placeholder="https://.../image.png"
            onInput={(e) => setImageUrl((e.target as HTMLInputElement).value)} />
        )}

        {error && <p class="ce-error">{error}</p>}
        <div class="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button disabled={!canSave} onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
