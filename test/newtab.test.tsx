import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { NewTab } from '../src/components/NewTab';
import * as storage from '../src/lib/storage';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';

vi.mock('sortablejs', () => ({ default: { create: vi.fn(() => ({ destroy: vi.fn() })) } }));

describe('NewTab', () => {
  beforeEach(async () => { await storage.setSettings({ ...DEFAULT_SETTINGS, onboarded: true }); });

  it('renders the add button after load', async () => {
    render(<NewTab />);
    await waitFor(() => expect(screen.getByLabelText('+ Add')).toBeTruthy());
  });

  it('opens the Store when add is clicked', async () => {
    render(<NewTab />);
    await waitFor(() => screen.getByLabelText('+ Add'));
    fireEvent.click(screen.getByLabelText('+ Add'));
    expect(screen.getByText('Add a tile')).toBeTruthy();
  });

  it('opens card editor when Link card is chosen from Store', async () => {
    render(<NewTab />);
    await waitFor(() => screen.getByLabelText('+ Add'));
    fireEvent.click(screen.getByLabelText('+ Add'));
    fireEvent.click(screen.getByText('Link card'));
    expect(screen.getByText('Add card')).toBeTruthy();
  });

  it('adds a widget tile when Note is chosen from Store', async () => {
    render(<NewTab />);
    await waitFor(() => screen.getByLabelText('+ Add'));
    fireEvent.click(screen.getByLabelText('+ Add'));
    fireEvent.click(screen.getByText('Note'));
    await waitFor(() => expect(document.querySelector('.widget-card')).toBeTruthy());
  });

  it('toggles edit mode via the Edit button', async () => {
    render(<NewTab />);
    await waitFor(() => screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByText('Done')).toBeTruthy();
  });

  it('no longer renders a header clock gear', async () => {
    render(<NewTab />);
    await waitFor(() => screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.queryByLabelText('Clock settings')).toBeNull();
  });
});
