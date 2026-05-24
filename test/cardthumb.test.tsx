import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { CardThumb } from '../src/components/CardThumb';
import { Dial } from '../src/lib/types';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';

const dial: Dial = { id: 'a', url: 'https://github.com', title: 'GitHub', imageRef: 'letter', color: '#123456', order: 0 };

describe('CardThumb', () => {
  it('renders a letter for letter mode', async () => {
    render(<CardThumb dial={dial} settings={DEFAULT_SETTINGS} />);
    await waitFor(() => expect(screen.getByText('G')).toBeTruthy());
  });

  it('renders an image for a favicon dial and cascades apple-touch -> favicon -> letter on error', async () => {
    const { container } = render(
      <CardThumb dial={{ ...dial, imageRef: 'favicon' }} settings={DEFAULT_SETTINGS} />,
    );
    await waitFor(() => expect(container.querySelector('img')).toBeTruthy());
    fireEvent.error(container.querySelector('img')!);
    await waitFor(() => expect(container.querySelector('img')).toBeTruthy());
    fireEvent.error(container.querySelector('img')!);
    await waitFor(() => expect(screen.getByText('G')).toBeTruthy());
  });
});
