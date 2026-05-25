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

describe('Settings without clock controls', () => {
  it('no longer renders clock controls', () => {
    render(<Settings settings={DEFAULT_SETTINGS} onChange={() => {}} onClose={() => {}} onRestored={() => {}} />);
    expect(screen.queryByLabelText('Clock format')).toBeNull();
    expect(screen.queryByLabelText('World clocks')).toBeNull();
  });
});

describe('Settings language picker', () => {
  it('changes the language', () => {
    const onChange = vi.fn();
    render(<Settings settings={DEFAULT_SETTINGS} onChange={onChange} onClose={() => {}} onRestored={() => {}} />);
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'ru' } });
    expect(onChange).toHaveBeenCalledWith({ language: 'ru' });
  });
});
