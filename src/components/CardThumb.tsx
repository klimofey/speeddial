import { useEffect, useState } from 'preact/hooks';
import { Dial, Settings } from '../lib/types';
import { Preview, resolvePreview, letterFallback } from '../lib/images';

export function CardThumb({ dial, settings }: { dial: Dial; settings: Settings }) {
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    let alive = true;
    void resolvePreview(dial, settings).then((p) => { if (alive) setPreview(p); });
    return () => { alive = false; };
  }, [dial, settings]);

  const onImgError = () => {
    if (preview?.kind === 'favicon' && preview.next) setPreview({ kind: 'favicon', src: preview.next });
    else if (preview?.kind === 'image' && preview.fallback) setPreview({ kind: 'image', src: preview.fallback });
    else setPreview(letterFallback(dial));
  };

  return (
    <div class="dial-thumb">
      {preview?.kind === 'image' && <img src={preview.src} alt="" onError={onImgError} />}
      {preview?.kind === 'favicon' && <img class="dial-favicon" src={preview.src} alt="" onError={onImgError} />}
      {preview?.kind === 'letter' && (
        <span class="dial-letter" style={{ background: preview.color }}>{preview.letter}</span>
      )}
    </div>
  );
}
