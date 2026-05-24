import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { Clock, greeting } from '../src/components/Clock';

describe('greeting', () => {
  it('says good morning at 9am', () => { expect(greeting(9)).toBe('Good morning'); });
  it('says good afternoon at 14', () => { expect(greeting(14)).toBe('Good afternoon'); });
  it('says good evening at 20', () => { expect(greeting(20)).toBe('Good evening'); });
});

describe('Clock', () => {
  beforeEach(() => vi.useFakeTimers().setSystemTime(new Date('2026-05-24T09:00:00')));
  afterEach(() => vi.useRealTimers());
  it('renders a greeting with the name', () => {
    render(<Clock name="Alex" />);
    expect(screen.getByText(/Good morning, Alex/)).toBeTruthy();
  });
});
