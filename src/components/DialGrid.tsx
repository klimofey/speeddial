import { useEffect, useRef } from 'preact/hooks';
import Sortable from 'sortablejs';
import { Dial, Settings } from '../lib/types';
import { DialCard } from './DialCard';

interface Props {
  dials: Dial[];
  settings: Settings;
  onEdit: (dial: Dial) => void;
  onDelete: (id: string) => void;
  onConfig?: (dial: Dial) => void;
  onReorder: (orderedIds: string[]) => void;
  editing?: boolean;
  onResize?: (id: string, size: { w: number; h: number }) => void;
}

export function DialGrid({ dials, settings, onEdit, onDelete, onConfig, onReorder, editing = false, onResize }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !editing) return;
    const sortable = Sortable.create(ref.current, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      draggable: '.dial-card',
      onEnd: () => {
        const ids = Array.from(ref.current!.querySelectorAll<HTMLElement>('.dial-card'))
          .map((el) => el.dataset.id!)
          .filter(Boolean);
        onReorder(ids);
      },
    });
    return () => sortable.destroy();
  }, [editing, onReorder]);

  return (
    <div class="dial-grid" data-size={settings.cardSize} ref={ref}>
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
    </div>
  );
}
