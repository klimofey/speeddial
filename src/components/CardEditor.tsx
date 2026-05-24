import { useState } from 'preact/hooks';
import { Dial, Settings, ImageRef } from '../lib/types';
import { fileToDataUrl, cacheImageFromUrl } from '../lib/images';
import { setImage } from '../lib/storage';
import { colorForKey } from '../lib/color';

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

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{initial ? 'Edit card' : 'Add card'}</h3>

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
