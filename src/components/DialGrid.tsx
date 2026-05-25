import { useEffect, useRef } from 'preact/hooks';
import Sortable from 'sortablejs';
import { Dial, Settings } from '../lib/types';
import { DialCard } from './DialCard';
import { t } from '../lib/i18n';

interface Props {
  dials: Dial[];
  settings: Settings;
  onEdit: (dial: Dial) => void;
  onDelete: (id: string) => void;
  onConfig?: (dial: Dial) => void;
  onReorder?: (orderedIds: string[]) => void;
  onSorted?: () => void;
  onAdd?: () => void;
  zone?: 'top' | 'grid';
  editing?: boolean;
  onResize?: (id: string, size: { w: number; h: number }) => void;
}

export function DialGrid({ dials, settings, onEdit, onDelete, onConfig, onReorder, onSorted, onAdd, zone = 'grid', editing = false, onResize }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !editing) return;
    const el = ref.current;
    const sortable = Sortable.create(el, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      draggable: '.dial-card',
      group: 'dials', // shared so cards can be dragged between the top zone and the grid
      forceFallback: true, // pointer-based drag: consistent across browsers + works cross-zone
      onEnd: () => {
        if (onSorted) { onSorted(); return; }
        const ids = Array.from(el.querySelectorAll<HTMLElement>('.dial-card'))
          .map((node) => node.dataset.id!)
          .filter(Boolean);
        onReorder?.(ids);
      },
    });
    return () => sortable.destroy();
  }, [editing, onReorder, onSorted]);

  return (
    <div class="dial-grid" data-size={settings.cardSize} data-zone={zone} data-editing={editing} ref={ref}>
      {dials.map((dial) => (
        <DialCard
          key={dial.id}
          dial={dial}
          settings={settings}
          onEdit={onEdit}
          onDelete={onDelete}
          onConfig={onConfig}
          editing={editing}
          onResize={onResize}
        />
      ))}
      {onAdd && (
        <button type="button" class="dial-add" aria-label={t('add')} onClick={onAdd}>+</button>
      )}
    </div>
  );
}
