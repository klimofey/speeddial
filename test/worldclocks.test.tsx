import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { WorldClocks } from '../src/components/WorldClocks';
import { WorldClock } from '../src/lib/types';

const clocks: WorldClock[] = [
  { id: '1', timeZone: 'UTC', label: 'UTC' },
  { id: '2', timeZone: 'America/New_York', label: 'New York' },
];

describe('WorldClocks', () => {
  beforeEach(() => vi.useFakeTimers().setSystemTime(new Date('2026-05-24T12:00:00Z')));
  afterEach(() => vi.useRealTimers());

  it('renders an item per clock with its label and zone time', () => {
    render(<WorldClocks clocks={clocks} format="24h" />);
    expect(screen.getByText('New York')).toBeTruthy();
    expect(screen.getByText('12:00')).toBeTruthy(); // UTC noon
    expect(screen.getByText('08:00')).toBeTruthy(); // New York (EDT, UTC-4)
  });

  it('renders nothing when there are no clocks', () => {
    const { container } = render(<WorldClocks clocks={[]} format="24h" />);
    expect(container.querySelector('.world-clocks')).toBeNull();
  });

  it('shows --:-- for an invalid time zone', () => {
    render(<WorldClocks clocks={[{ id: 'x', timeZone: 'Not/AZone', label: 'Bad' }]} format="24h" />);
    expect(screen.getByText('--:--')).toBeTruthy();
  });
});
