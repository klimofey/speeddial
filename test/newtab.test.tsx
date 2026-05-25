import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { NewTab } from '../src/components/NewTab';

vi.mock('sortablejs', () => ({ default: { create: vi.fn(() => ({ destroy: vi.fn() })) } }));

describe('NewTab', () => {
  it('renders the add button after load', async () => {
    render(<NewTab />);
    await waitFor(() => expect(screen.getByText('+ Add')).toBeTruthy());
  });

  it('opens the Store when add is clicked', async () => {
    render(<NewTab />);
    await waitFor(() => screen.getByText('+ Add'));
    fireEvent.click(screen.getByText('+ Add'));
    expect(screen.getByText('Add a tile')).toBeTruthy();
  });

  it('opens card editor when Link card is chosen from Store', async () => {
    render(<NewTab />);
    await waitFor(() => screen.getByText('+ Add'));
    fireEvent.click(screen.getByText('+ Add'));
    fireEvent.click(screen.getByText('Link card'));
    expect(screen.getByText('Add card')).toBeTruthy();
  });

  it('adds a widget tile when Note is chosen from Store', async () => {
    render(<NewTab />);
    await waitFor(() => screen.getByText('+ Add'));
    fireEvent.click(screen.getByText('+ Add'));
    fireEvent.click(screen.getByText('Note'));
    await waitFor(() => expect(document.querySelector('.widget-card')).toBeTruthy());
  });

  it('toggles edit mode via the Edit button', async () => {
    render(<NewTab />);
    await waitFor(() => screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByText('Done')).toBeTruthy();
  });

  it('opens clock config from the gear in edit mode', async () => {
    render(<NewTab />);
    await waitFor(() => screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.queryByText('Clock')).toBeNull();
    fireEvent.click(screen.getByLabelText('Clock settings'));
    expect(screen.getByLabelText('Show clock')).toBeTruthy();
  });
});
