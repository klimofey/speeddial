import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { Clock, greeting } from '../src/components/Clock';

describe('greeting', () => {
  it('returns morning key before noon', () => { expect(greeting(9)).toBe('greeting_morning'); });
  it('returns afternoon key', () => { expect(greeting(14)).toBe('greeting_afternoon'); });
  it('returns evening key', () => { expect(greeting(20)).toBe('greeting_evening'); });
});

describe('Clock', () => {
  beforeEach(() => vi.useFakeTimers().setSystemTime(new Date('2026-05-24T13:05:00')));
  afterEach(() => vi.useRealTimers());

  it('renders a greeting with the name', () => {
    render(<Clock name="Alex" format="24h" />);
    expect(screen.getByText(/Good afternoon, Alex/)).toBeTruthy();
  });

  it('renders 24h time without AM/PM', () => {
    render(<Clock name={null} format="24h" />);
    expect(screen.getByText('13:05')).toBeTruthy();
  });

  it('renders 12h time with PM', () => {
    render(<Clock name={null} format="12h" />);
    expect(screen.getByText('01:05 PM')).toBeTruthy();
  });
});
