import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { AppProvider, useApp } from '../src/state/AppState';
import { getWidget } from '../src/components/widgets/registry';

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

function WidgetProbe() {
  const { dials, addWidget, ready } = useApp();
  if (!ready) return <span>loading</span>;
  const w = dials[0]?.widget;
  return (
    <div>
      <span data-testid="count">{dials.length}</span>
      <span data-testid="wtype">{w?.type ?? '-'}</span>
      <span data-testid="wconfig">{w ? JSON.stringify(w.config) : '-'}</span>
      <button onClick={() => addWidget('note')}>add-widget</button>
    </div>
  );
}

function ResizeProbe() {
  const { dials, addDial, resizeDial, ready } = useApp();
  if (!ready) return <span>loading</span>;
  const s = dials[0]?.size;
  return (
    <div>
      <span data-testid="size">{dials[0] ? `${s?.w}x${s?.h}` : '-'}</span>
      <button onClick={() => addDial({ url: 'https://x.com', title: 'X' })}>add</button>
      <button onClick={() => resizeDial(dials[0].id, { w: 2, h: 3 })}>resize</button>
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

  it('addWidget note creates a dial with widget.type===note and default config', async () => {
    render(<AppProvider><WidgetProbe /></AppProvider>);
    await waitFor(() => screen.getByText('add-widget'));
    fireEvent.click(screen.getByText('add-widget'));
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
    expect(screen.getByTestId('wtype').textContent).toBe('note');
    const noteDefault = getWidget('note')!.defaultConfig;
    expect(screen.getByTestId('wconfig').textContent).toBe(JSON.stringify(noteDefault));
  });

  it('resizes a dial and persists the new size', async () => {
    render(<AppProvider><ResizeProbe /></AppProvider>);
    await waitFor(() => screen.getByText('add'));
    fireEvent.click(screen.getByText('add'));
    await waitFor(() => expect(screen.getByTestId('size').textContent).toBe('1x1'));
    fireEvent.click(screen.getByText('resize'));
    await waitFor(() => expect(screen.getByTestId('size').textContent).toBe('2x3'));
  });
});
