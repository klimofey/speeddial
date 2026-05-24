import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { DialCard } from '../src/components/DialCard';
import { Dial } from '../src/lib/types';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';

const dial: Dial = { id: 'a', url: 'https://github.com', title: 'GitHub', imageRef: 'letter', color: '#123456', order: 0 };

describe('DialCard', () => {
  it('renders the title', async () => {
    render(<DialCard dial={dial} settings={DEFAULT_SETTINGS} onEdit={() => {}} onDelete={() => {}} />);
    await waitFor(() => expect(screen.getByText('GitHub')).toBeTruthy());
  });

  it('renders a letter preview for letter mode', async () => {
    render(<DialCard dial={dial} settings={DEFAULT_SETTINGS} onEdit={() => {}} onDelete={() => {}} />);
    await waitFor(() => expect(screen.getByText('G')).toBeTruthy());
  });

  it('calls onEdit when the edit action is triggered', async () => {
    const onEdit = vi.fn();
    render(<DialCard dial={dial} settings={DEFAULT_SETTINGS} onEdit={onEdit} onDelete={() => {}} />);
    await waitFor(() => screen.getByLabelText('Edit GitHub'));
    fireEvent.click(screen.getByLabelText('Edit GitHub'));
    expect(onEdit).toHaveBeenCalledWith(dial);
  });

  it('applies a grid span style from size', () => {
    const { container } = render(
      <DialCard dial={{ ...dial, size: { w: 2, h: 3 } }} settings={DEFAULT_SETTINGS} onEdit={() => {}} onDelete={() => {}} />,
    );
    const el = container.querySelector('.dial-card') as HTMLElement;
    expect(el.style.gridColumn).toBe('span 2');
    expect(el.style.gridRow).toBe('span 3');
  });

  it('shows a resize handle only in editing mode', () => {
    const normal = render(<DialCard dial={dial} settings={DEFAULT_SETTINGS} onEdit={() => {}} onDelete={() => {}} />);
    expect(normal.container.querySelector('.dial-resize')).toBeNull();
    const editing = render(<DialCard dial={dial} settings={DEFAULT_SETTINGS} editing onEdit={() => {}} onDelete={() => {}} onResize={() => {}} />);
    expect(editing.container.querySelector('.dial-resize')).toBeTruthy();
  });

  it('resizes via a handle drag (80px per cell)', () => {
    const onResize = vi.fn();
    render(<DialCard dial={{ ...dial, size: { w: 1, h: 1 } }} settings={DEFAULT_SETTINGS} editing onEdit={() => {}} onDelete={() => {}} onResize={onResize} />);
    fireEvent.mouseDown(screen.getByLabelText('Resize GitHub'), { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 160, clientY: 0 });
    expect(onResize).toHaveBeenLastCalledWith('a', { w: 3, h: 1 });
    fireEvent.mouseUp(window);
  });

  it('falls back apple-touch-icon -> favicon -> letter on image errors', async () => {
    const { container } = render(
      <DialCard dial={{ ...dial, imageRef: 'favicon', title: 'GitHub', url: 'https://github.com' }}
        settings={DEFAULT_SETTINGS} onEdit={() => {}} onDelete={() => {}} />,
    );
    await waitFor(() => expect(container.querySelector('img')).toBeTruthy());
    fireEvent.error(container.querySelector('img')!);
    await waitFor(() => expect(container.querySelector('img')).toBeTruthy());
    fireEvent.error(container.querySelector('img')!);
    await waitFor(() => expect(screen.getByText('G')).toBeTruthy());
  });

  it('prevents navigation on click while editing', () => {
    const { container } = render(<DialCard dial={dial} settings={DEFAULT_SETTINGS} editing onEdit={() => {}} onDelete={() => {}} onResize={() => {}} />);
    const link = container.querySelector('.dial-link') as HTMLElement;
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});
