import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { getWidget, WIDGETS } from '../src/components/widgets/registry';
import { WidgetHost } from '../src/components/WidgetHost';
import { NoteConfigEditor } from '../src/components/widgets/NoteWidget';
import { ClockConfigEditor, ClockRender } from '../src/components/widgets/ClockWidget';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';

describe('widget registry', () => {
  it('lists note and clock with default sizes', () => {
    expect(WIDGETS.map((w) => w.type).sort()).toEqual(['clock', 'note']);
    expect(getWidget('note')?.defaultSize).toEqual({ w: 2, h: 1 });
  });
  it('getWidget returns undefined for unknown', () => {
    expect(getWidget('nope' as never)).toBeUndefined();
  });
});

describe('WidgetHost', () => {
  it('renders a note widget', () => {
    render(<WidgetHost widget={{ type: 'note', config: { text: 'hello' } }} settings={DEFAULT_SETTINGS} />);
    expect(screen.getByText('hello')).toBeTruthy();
  });
  it('renders a clock widget time', () => {
    const { container } = render(<WidgetHost widget={{ type: 'clock', config: { timeZone: 'UTC', label: 'UTC', showGreeting: false, format: '24h' } }} settings={DEFAULT_SETTINGS} />);
    expect(container.querySelector('.w-clock-time')?.textContent).toMatch(/\d\d:\d\d/);
  });
  it('renders a placeholder for an unknown type', () => {
    const { container } = render(<WidgetHost widget={{ type: 'xxx', config: {} } as never} settings={DEFAULT_SETTINGS} />);
    expect(container.querySelector('.w-unknown')).toBeTruthy();
  });
});

describe('NoteConfigEditor', () => {
  it('emits text changes', () => {
    const onChange = vi.fn();
    render(<NoteConfigEditor config={{ text: '' }} onChange={onChange} />);
    fireEvent.input(screen.getByPlaceholderText('Write a note…'), { target: { value: 'hi' } });
    expect(onChange).toHaveBeenCalledWith({ text: 'hi' });
  });
});

describe('clock format lives in the widget config', () => {
  it('ClockConfigEditor emits a format change', () => {
    const onChange = vi.fn();
    render(<ClockConfigEditor config={{ timeZone: '', label: '', showGreeting: true, format: '24h' }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Clock format'), { target: { value: '12h' } });
    expect(onChange).toHaveBeenCalledWith({ timeZone: '', label: '', showGreeting: true, format: '12h' });
  });

  it('ClockRender uses 12-hour format from its own config', () => {
    const { container } = render(<ClockRender config={{ timeZone: 'UTC', label: '', showGreeting: false, format: '12h' }} />);
    const text = container.querySelector('.w-clock-time')?.textContent ?? '';
    expect(text).toMatch(/\d{1,2}:\d\d/);
    expect(text).toMatch(/AM|PM/i);
  });
});
