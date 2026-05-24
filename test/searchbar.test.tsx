import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { searchUrl, SearchBar } from '../src/components/SearchBar';
import * as suggest from '../src/lib/suggest';

describe('searchUrl', () => {
  it('builds a Google query URL', () => {
    expect(searchUrl('google', 'cats')).toBe('https://www.google.com/search?q=cats');
  });
  it('builds a DuckDuckGo query URL', () => {
    expect(searchUrl('duckduckgo', 'a b')).toBe('https://duckduckgo.com/?q=a%20b');
  });
  it('builds a Bing query URL', () => {
    expect(searchUrl('bing', 'x')).toBe('https://www.bing.com/search?q=x');
  });
});

describe('SearchBar suggestions', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows suggestions after typing', async () => {
    vi.spyOn(suggest, 'fetchSuggestions').mockResolvedValue(['cats', 'cars', 'care']);
    render(<SearchBar engine="google" suggestProvider="duckduckgo" onFilter={() => {}} />);
    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'ca' } });
    await waitFor(() => expect(screen.getByText('cats')).toBeTruthy());
  });

  it('does not fetch when the provider is off', async () => {
    const spy = vi.spyOn(suggest, 'fetchSuggestions').mockResolvedValue(['x']);
    render(<SearchBar engine="google" suggestProvider="off" onFilter={() => {}} />);
    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'ca' } });
    await new Promise((r) => setTimeout(r, 200));
    expect(spy).not.toHaveBeenCalled();
  });

  it('highlights a suggestion with ArrowDown', async () => {
    vi.spyOn(suggest, 'fetchSuggestions').mockResolvedValue(['cats', 'cars']);
    render(<SearchBar engine="google" suggestProvider="duckduckgo" onFilter={() => {}} />);
    const input = screen.getByRole('textbox');
    fireEvent.input(input, { target: { value: 'ca' } });
    await waitFor(() => screen.getByText('cats'));
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByText('cats').className).toContain('active');
  });

  it('clears suggestions on Escape', async () => {
    vi.spyOn(suggest, 'fetchSuggestions').mockResolvedValue(['cats']);
    render(<SearchBar engine="google" suggestProvider="duckduckgo" onFilter={() => {}} />);
    const input = screen.getByRole('textbox');
    fireEvent.input(input, { target: { value: 'ca' } });
    await waitFor(() => screen.getByText('cats'));
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('cats')).toBeNull();
  });

  it('closes suggestions when the input loses focus (outside click)', async () => {
    vi.spyOn(suggest, 'fetchSuggestions').mockResolvedValue(['cats']);
    render(<SearchBar engine="google" suggestProvider="duckduckgo" onFilter={() => {}} />);
    const input = screen.getByRole('textbox');
    fireEvent.input(input, { target: { value: 'ca' } });
    await waitFor(() => screen.getByText('cats'));
    fireEvent.blur(input);
    expect(screen.queryByText('cats')).toBeNull();
  });
});
