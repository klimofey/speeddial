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
    // SortableJS mutates the DOM, but Preact owns these keyed nodes. After reading the
    // new order, revert SortableJS's move so the DOM matches Preact's vdom; the new
    // order is then applied via state and Preact re-renders as the sole DOM owner.
    // Without this, cross-zone drags duplicate/overlap nodes.
    const revert = (evt: { item?: HTMLElement; from?: HTMLElement; oldIndex?: number }) => {
      const { item, from, oldIndex } = evt;
      if (!item || !from) return;
      const ref = oldIndex != null ? from.children[oldIndex] : null;
      if (ref) from.insertBefore(item, ref);
      else from.appendChild(item);
    };
    const sortable = Sortable.create(el, {
      animation: 0, // FLIP transforms misbehave on CSS grid (leave nodes displaced)
      ghostClass: 'sortable-ghost',
      draggable: '.dial-card',
      group: 'dials', // shared so cards can be dragged between the top zone and the grid
      forceFallback: true, // pointer-based drag: consistent across browsers + works cross-zone
      onEnd: (evt) => {
        if (onSorted) { onSorted(); revert(evt); return; }
        const ids = Array.from(el.querySelectorAll<HTMLElement>('.dial-card'))
          .map((node) => node.dataset.id!)
          .filter(Boolean);
        revert(evt);
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
