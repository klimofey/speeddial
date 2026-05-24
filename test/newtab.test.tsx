import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { NewTab } from '../src/components/NewTab';

vi.mock('sortablejs', () => ({ default: { create: vi.fn(() => ({ destroy: vi.fn() })) } }));

describe('NewTab', () => {
  it('renders the add-card button after load', async () => {
    render(<NewTab />);
    await waitFor(() => expect(screen.getByText('+ Add card')).toBeTruthy());
  });

  it('opens the card editor when add is clicked', async () => {
    render(<NewTab />);
    await waitFor(() => screen.getByText('+ Add card'));
    fireEvent.click(screen.getByText('+ Add card'));
    expect(screen.getByText('Add card')).toBeTruthy();
  });

  it('toggles edit mode via the Edit button', async () => {
    render(<NewTab />);
    await waitFor(() => screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByText('Done')).toBeTruthy();
  });
});
