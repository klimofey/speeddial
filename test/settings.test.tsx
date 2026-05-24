import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { Settings } from '../src/components/Settings';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';

describe('Settings background picker', () => {
  it('emits a color background when the background type is set to color', () => {
    const onChange = vi.fn();
    render(<Settings settings={DEFAULT_SETTINGS} onChange={onChange} onClose={() => {}} onRestored={() => {}} />);
    fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'color' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ background: expect.objectContaining({ type: 'color' }) }),
    );
  });

  it('emits the chosen color from the color input', () => {
    const onChange = vi.fn();
    const settings = { ...DEFAULT_SETTINGS, background: { type: 'color' as const, value: '#000000' } };
    render(<Settings settings={settings} onChange={onChange} onClose={() => {}} onRestored={() => {}} />);
    fireEvent.input(screen.getByLabelText('Background color'), { target: { value: '#ff0000' } });
    expect(onChange).toHaveBeenCalledWith({ background: { type: 'color', value: '#ff0000' } });
  });

  it('emits the gradient string from the gradient input', () => {
    const onChange = vi.fn();
    const settings = { ...DEFAULT_SETTINGS, background: { type: 'gradient' as const, value: '' } };
    render(<Settings settings={settings} onChange={onChange} onClose={() => {}} onRestored={() => {}} />);
    fireEvent.input(screen.getByLabelText('Background gradient'), { target: { value: 'linear-gradient(0deg,#111,#222)' } });
    expect(onChange).toHaveBeenCalledWith({ background: { type: 'gradient', value: 'linear-gradient(0deg,#111,#222)' } });
  });
});

describe('Settings clock options', () => {
  it('emits clockFormat when the format select changes', () => {
    const onChange = vi.fn();
    render(<Settings settings={DEFAULT_SETTINGS} onChange={onChange} onClose={() => {}} onRestored={() => {}} />);
    fireEvent.change(screen.getByLabelText('Clock format'), { target: { value: '12h' } });
    expect(onChange).toHaveBeenCalledWith({ clockFormat: '12h' });
  });

  it('adds a world clock when a zone is chosen', () => {
    const onChange = vi.fn();
    render(<Settings settings={DEFAULT_SETTINGS} onChange={onChange} onClose={() => {}} onRestored={() => {}} />);
    fireEvent.change(screen.getByLabelText('World clocks'), { target: { value: 'America/New_York' } });
    expect(onChange).toHaveBeenCalledWith({
      worldClocks: [expect.objectContaining({ timeZone: 'America/New_York', label: 'New York' })],
    });
  });

  it('removes a world clock', () => {
    const onChange = vi.fn();
    const settings = { ...DEFAULT_SETTINGS, worldClocks: [{ id: 'a', timeZone: 'UTC', label: 'UTC' }] };
    render(<Settings settings={settings} onChange={onChange} onClose={() => {}} onRestored={() => {}} />);
    fireEvent.click(screen.getByLabelText('Remove UTC'));
    expect(onChange).toHaveBeenCalledWith({ worldClocks: [] });
  });
});
