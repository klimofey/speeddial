import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { CardEditor } from '../src/components/CardEditor';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';

vi.mock('../src/lib/permissions', () => ({ ensureOriginPermission: vi.fn(async () => true) }));
vi.mock('../src/lib/metascrape', () => ({ scrapeBestImage: vi.fn(async () => 'https://cdn.example/hero.png') }));

describe('CardEditor', () => {
  it('disables save when URL is empty', () => {
    render(<CardEditor settings={DEFAULT_SETTINGS} onSave={() => {}} onClose={() => {}} />);
    expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('saves url + title + imageRef for a new card', () => {
    const onSave = vi.fn();
    render(<CardEditor settings={DEFAULT_SETTINGS} onSave={onSave} onClose={() => {}} />);
    fireEvent.input(screen.getByLabelText('URL'), { target: { value: 'https://x.com' } });
    fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'X' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://x.com', title: 'X', imageRef: 'favicon' }));
  });

  it('re-enables Save and shows an error when an image URL fails to load', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    const onSave = vi.fn();
    render(<CardEditor settings={DEFAULT_SETTINGS} onSave={onSave} onClose={() => {}} />);
    fireEvent.input(screen.getByLabelText('URL'), { target: { value: 'https://x.com' } });
    // switch preview mode to "Image URL"
    fireEvent.change(screen.getByLabelText('Preview'), { target: { value: 'url' } });
    fireEvent.input(screen.getByLabelText('Image URL'), { target: { value: 'https://bad/img.png' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(screen.getByText(/Could not load that image URL/)).toBeTruthy());
    expect(onSave).not.toHaveBeenCalled();
    expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(false);
    vi.unstubAllGlobals();
  });

  it('finds a better image and saves it as the card image', async () => {
    const onSave = vi.fn();
    render(<CardEditor settings={DEFAULT_SETTINGS} onSave={onSave} onClose={() => {}} />);
    fireEvent.input(screen.getByLabelText('URL'), { target: { value: 'https://github.com' } });
    fireEvent.click(screen.getByText('Find better image'));
    await waitFor(() => expect(screen.getByText(/Found a better image/)).toBeTruthy());
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ imageRef: expect.stringMatching(/^meta-/) }));
  });
});
