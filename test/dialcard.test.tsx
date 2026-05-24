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
});
