import { useEffect, useState } from 'preact/hooks';
import { Dial, Settings } from '../lib/types';
import { Preview, resolvePreview, letterFallback } from '../lib/images';
import { spanFromDelta } from '../lib/layout';

interface Props {
  dial: Dial;
  settings: Settings;
  onEdit: (dial: Dial) => void;
  onDelete: (id: string) => void;
  editing?: boolean;
  onResize?: (id: string, size: { w: number; h: number }) => void;
}

export function DialCard({ dial, settings, onEdit, onDelete, editing = false, onResize }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const size = dial.size ?? { w: 1, h: 1 };

  useEffect(() => {
    let alive = true;
    void resolvePreview(dial, settings).then((p) => { if (alive) setPreview(p); });
    return () => { alive = false; };
  }, [dial, settings]);

  const onImgError = () => setPreview(letterFallback(dial));

  // Drag the corner handle: every RESIZE_STEP_PX of movement changes the span by
  // one cell (no DOM measurement needed, so it is robust and testable).
  const startResize = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
    const move = (ev: MouseEvent) => {
      onResize?.(dial.id, {
        w: spanFromDelta(start.w, ev.clientX - start.x),
        h: spanFromDelta(start.h, ev.clientY - start.y),
      });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div
      class={`dial-card${editing ? ' editing' : ''}`}
      data-id={dial.id}
      style={{ gridColumn: `span ${size.w}`, gridRow: `span ${size.h}` }}
    >
      <a class="dial-link" href={dial.url} onClick={(e) => { if (editing) e.preventDefault(); }}>
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
      {editing && (
        <span class="dial-resize" aria-label={`Resize ${dial.title}`} role="button" onMouseDown={startResize} />
      )}
    </div>
  );
}
