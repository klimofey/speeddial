import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { RecentRow } from '../src/components/RecentRow';
import { RecentSite } from '../src/lib/recent';

const sites: RecentSite[] = [
  { url: 'https://a.com/x', title: 'A', origin: 'https://a.com', score: 5 },
  { url: 'https://b.com/', title: 'B', origin: 'https://b.com', score: 3 },
];

describe('RecentRow', () => {
  it('renders a tile per site', () => {
    render(<RecentRow sites={sites} onPin={() => {}} />);
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('B')).toBeTruthy();
  });

  it('renders nothing when empty', () => {
    const { container } = render(<RecentRow sites={[]} onPin={() => {}} />);
    expect(container.querySelector('.recent-row')).toBeNull();
  });

  it('calls onPin with the site when + is clicked', () => {
    const onPin = vi.fn();
    render(<RecentRow sites={sites} onPin={onPin} />);
    fireEvent.click(screen.getByLabelText('Pin A'));
    expect(onPin).toHaveBeenCalledWith(sites[0]);
  });
});
