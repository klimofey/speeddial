import { useEffect, useState } from 'preact/hooks';
import { Dial, Settings } from '../lib/types';
import { Preview, resolvePreview, letterFallback } from '../lib/images';

interface Props {
  dial: Dial;
  settings: Settings;
  onEdit: (dial: Dial) => void;
  onDelete: (id: string) => void;
}

export function DialCard({ dial, settings, onEdit, onDelete }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    let alive = true;
    void resolvePreview(dial, settings).then((p) => { if (alive) setPreview(p); });
    return () => { alive = false; };
  }, [dial, settings]);

  // If a remote/favicon image fails at runtime, fall back to the letter tile.
  const onImgError = () => setPreview(letterFallback(dial));

  return (
    <div class="dial-card" data-id={dial.id}>
      <a class="dial-link" href={dial.url}>
        <div class="dial-thumb">
          {preview?.kind === 'image' && <img src={preview.src} alt="" onError={onImgError} />}
          {preview?.kind === 'favicon' && <img class="dial-favicon" src={preview.src} alt="" onError={onImgError} />}
          {preview?.kind === 'letter' && (
            <span class="dial-letter" style={{ background: preview.color }}>{preview.letter}</span>
          )}
        </div>
        <span class="dial-title">{dial.title}</span>
      </a>
      <div class="dial-actions">
        <button aria-label={`Edit ${dial.title}`} onClick={() => onEdit(dial)}>✎</button>
        <button aria-label={`Delete ${dial.title}`} onClick={() => onDelete(dial.id)}>✕</button>
      </div>
    </div>
  );
}
