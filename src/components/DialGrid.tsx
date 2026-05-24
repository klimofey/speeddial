import { useEffect, useRef } from 'preact/hooks';
import Sortable from 'sortablejs';
import { Dial, Settings } from '../lib/types';
import { DialCard } from './DialCard';

interface Props {
  dials: Dial[];
  settings: Settings;
  onEdit: (dial: Dial) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
}

export function DialGrid({ dials, settings, onEdit, onDelete, onReorder }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
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
  }, [onReorder]);

  return (
    <div class="dial-grid" data-size={settings.cardSize} ref={ref}>
      {dials.map((dial) => (
        <DialCard key={dial.id} dial={dial} settings={settings} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
