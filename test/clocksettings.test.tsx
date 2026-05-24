import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { ClockSettings } from '../src/components/ClockSettings';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';

describe('ClockSettings', () => {
  it('toggles show clock', () => {
    const onChange = vi.fn();
    render(<ClockSettings settings={{ ...DEFAULT_SETTINGS, showClock: true }} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Show clock'));
    expect(onChange).toHaveBeenCalledWith({ showClock: false });
  });
  it('changes the clock format', () => {
    const onChange = vi.fn();
    render(<ClockSettings settings={DEFAULT_SETTINGS} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Clock format'), { target: { value: '12h' } });
    expect(onChange).toHaveBeenCalledWith({ clockFormat: '12h' });
  });
  it('adds a world clock', () => {
    const onChange = vi.fn();
    render(<ClockSettings settings={DEFAULT_SETTINGS} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('World clocks'), { target: { value: 'America/New_York' } });
    expect(onChange).toHaveBeenCalledWith({ worldClocks: [expect.objectContaining({ timeZone: 'America/New_York', label: 'New York' })] });
  });
});
