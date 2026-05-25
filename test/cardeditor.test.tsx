import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { CardEditor } from '../src/components/CardEditor';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';

vi.mock('../src/lib/permissions', () => ({
  hasOriginPermission: vi.fn(async () => false),
  ensureOriginPermission: vi.fn(async () => true),
}));
vi.mock('../src/lib/metascrape', async (importActual) => {
  const actual = await importActual<typeof import('../src/lib/metascrape')>();
  return {
    ...actual,
    scrapeImages: vi.fn(async () => ['https://cdn.example/a.png', 'https://cdn.example/b.png']),
  };
});
// The rendered (background-tab) scrape is exercised in render-scrape.test.ts; here it
// would just block on the load timeout, so stub it to resolve to no extra candidates.
vi.mock('../src/lib/renderscrape', () => ({ scrapeRendered: vi.fn(async () => []) }));

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

  it('keeps the title empty when left blank (no URL-host fallback)', () => {
    const onSave = vi.fn();
    render(<CardEditor settings={DEFAULT_SETTINGS} onSave={onSave} onClose={() => {}} />);
    fireEvent.input(screen.getByLabelText('URL'), { target: { value: 'https://github.com' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: '' }));
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

  it('shows icon-service candidates immediately, before any permission', async () => {
    const { container } = render(<CardEditor settings={DEFAULT_SETTINGS} onSave={() => {}} onClose={() => {}} />);
    fireEvent.input(screen.getByLabelText('URL'), { target: { value: 'https://github.com' } });
    fireEvent.click(screen.getByText('Find better image'));
    await waitFor(() => expect(container.querySelectorAll('.ce-candidate').length).toBe(3));
    expect(screen.getByText('Allow access')).toBeTruthy();
  });

  it('appends scraped page images after Allow access; picking one saves a meta- image', async () => {
    const onSave = vi.fn();
    const { container } = render(<CardEditor settings={DEFAULT_SETTINGS} onSave={onSave} onClose={() => {}} />);
    fireEvent.input(screen.getByLabelText('URL'), { target: { value: 'https://github.com' } });
    fireEvent.click(screen.getByText('Find better image'));
    await waitFor(() => expect(container.querySelectorAll('.ce-candidate').length).toBe(3));
    fireEvent.click(screen.getByText('Allow access'));
    await waitFor(() => expect(container.querySelectorAll('.ce-candidate').length).toBe(5));
    fireEvent.click(container.querySelectorAll('.ce-candidate')[4]);
    await waitFor(() => expect(screen.getByText(/Selected/)).toBeTruthy());
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ imageRef: expect.stringMatching(/^meta-/) }));
  });

  it('scrapes directly (no Allow access) when permission is already granted', async () => {
    const perms = await import('../src/lib/permissions');
    (perms.hasOriginPermission as unknown as { mockResolvedValueOnce: (v: boolean) => void }).mockResolvedValueOnce(true);
    const { container } = render(<CardEditor settings={DEFAULT_SETTINGS} onSave={() => {}} onClose={() => {}} />);
    fireEvent.input(screen.getByLabelText('URL'), { target: { value: 'https://github.com' } });
    fireEvent.click(screen.getByText('Find better image'));
    await waitFor(() => expect(container.querySelectorAll('.ce-candidate').length).toBe(5));
    expect(screen.queryByText('Allow access')).toBeNull();
  });

  it('shows guidance when access is denied (icons remain)', async () => {
    const perms = await import('../src/lib/permissions');
    (perms.ensureOriginPermission as unknown as { mockResolvedValueOnce: (v: boolean) => void }).mockResolvedValueOnce(false);
    const { container } = render(<CardEditor settings={DEFAULT_SETTINGS} onSave={() => {}} onClose={() => {}} />);
    fireEvent.input(screen.getByLabelText('URL'), { target: { value: 'https://github.com' } });
    fireEvent.click(screen.getByText('Find better image'));
    await waitFor(() => screen.getByText('Allow access'));
    fireEvent.click(screen.getByText('Allow access'));
    await waitFor(() => expect(screen.getByText(/Access denied/)).toBeTruthy());
    expect(container.querySelectorAll('.ce-candidate').length).toBe(3);
  });
});
