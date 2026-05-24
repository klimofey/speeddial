import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import { DialGrid } from '../src/components/DialGrid';
import { Dial } from '../src/lib/types';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';
import Sortable from 'sortablejs';

vi.mock('sortablejs', () => ({ default: { create: vi.fn(() => ({ destroy: vi.fn() })) } }));

const dials: Dial[] = [
  { id: 'a', url: 'https://a.com', title: 'A', imageRef: 'letter', color: '#111', order: 0 },
  { id: 'b', url: 'https://b.com', title: 'B', imageRef: 'letter', color: '#222', order: 1 },
];

describe('DialGrid', () => {
  it('renders one card per dial', async () => {
    render(<DialGrid dials={dials} settings={DEFAULT_SETTINGS} onEdit={() => {}} onDelete={() => {}} onReorder={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('A')).toBeTruthy();
      expect(screen.getByText('B')).toBeTruthy();
    });
  });

  it('applies the card-size data attribute', async () => {
    const { container } = render(
      <DialGrid dials={dials} settings={{ ...DEFAULT_SETTINGS, cardSize: 'lg' }} onEdit={() => {}} onDelete={() => {}} onReorder={() => {}} />,
    );
    expect(container.querySelector('.dial-grid')?.getAttribute('data-size')).toBe('lg');
  });

  it('does not initialize SortableJS when not editing', () => {
    render(<DialGrid dials={dials} settings={DEFAULT_SETTINGS} onEdit={() => {}} onDelete={() => {}} onReorder={() => {}} />);
    expect((Sortable.create as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(0);
  });

  it('initializes SortableJS when editing', () => {
    render(<DialGrid dials={dials} settings={DEFAULT_SETTINGS} editing onEdit={() => {}} onDelete={() => {}} onReorder={() => {}} onResize={() => {}} />);
    expect((Sortable.create as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBeGreaterThan(0);
  });
});
