import { Dial, Settings } from '../lib/types';
import { spanFromDelta } from '../lib/layout';
import { CardThumb } from './CardThumb';
import { WidgetHost } from './WidgetHost';
import { t } from '../lib/i18n';

interface Props {
  dial: Dial;
  settings: Settings;
  onEdit: (dial: Dial) => void;
  onDelete: (id: string) => void;
  onConfig?: (dial: Dial) => void;
  editing?: boolean;
  onResize?: (id: string, size: { w: number; h: number }) => void;
}

export function DialCard({ dial, settings, onEdit, onDelete, onConfig, editing = false, onResize }: Props) {
  const size = dial.size ?? { w: 1, h: 1 };

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

  if (dial.widget) {
    return (
      <div
        class={`dial-card widget-card${editing ? ' editing' : ''}`}
        data-id={dial.id}
        style={{ gridColumn: `span ${size.w}`, gridRow: `span ${size.h}` }}
      >
        <div class="dial-thumb"><WidgetHost widget={dial.widget} settings={settings} /></div>
        <div class="dial-actions">
          <button aria-label={`Configure ${dial.widget.type}`} onClick={() => onConfig?.(dial)}>⚙</button>
          <button aria-label={`${t('delete')} widget`} onClick={() => onDelete(dial.id)}>✕</button>
        </div>
        {editing && <span class="dial-resize" role="button" aria-label="Resize widget" onMouseDown={startResize} />}
      </div>
    );
  }

  return (
    <div
      class={`dial-card${editing ? ' editing' : ''}`}
      data-id={dial.id}
      style={{ gridColumn: `span ${size.w}`, gridRow: `span ${size.h}` }}
    >
      <a class="dial-link" href={dial.url} onClick={(e) => { if (editing) e.preventDefault(); }}>
        <CardThumb dial={dial} settings={settings} />
        {dial.title && <span class="dial-title">{dial.title}</span>}
      </a>
      <div class="dial-actions">
        <button aria-label={`${t('edit')} ${dial.title}`} onClick={() => onEdit(dial)}>✎</button>
        <button aria-label={`${t('delete')} ${dial.title}`} onClick={() => onDelete(dial.id)}>✕</button>
      </div>
      {editing && (
        <span class="dial-resize" aria-label={`Resize ${dial.title}`} role="button" onMouseDown={startResize} />
      )}
    </div>
  );
}
