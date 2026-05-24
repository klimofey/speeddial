import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { AppProvider, useApp } from '../src/state/AppState';

function Probe() {
  const { dials, addDial, ready } = useApp();
  if (!ready) return <span>loading</span>;
  return (
    <div>
      <span data-testid="count">{dials.length}</span>
      <button onClick={() => addDial({ url: 'https://x.com', title: 'X' })}>add</button>
    </div>
  );
}

describe('AppState', () => {
  it('loads and exposes empty dials initially', async () => {
    render(<AppProvider><Probe /></AppProvider>);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
  });

  it('adds a dial and updates count', async () => {
    render(<AppProvider><Probe /></AppProvider>);
    await waitFor(() => screen.getByText('add'));
    fireEvent.click(screen.getByText('add'));
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
  });
});
