import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { AppProvider, useApp } from '../src/state/AppState';
import { getWidget } from '../src/components/widgets/registry';
import * as storage from '../src/lib/storage';

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

function LayoutProbe() {
  const { dials, applyLayout, ready } = useApp();
  if (!ready) return <span>loading</span>;
  const byId = (id: string) => dials.find((d) => d.id === id);
  return (
    <div>
      <span data-testid="zones">{dials.map((d) => `${d.id}:${d.zone ?? 'grid'}:${d.order}`).sort().join(',')}</span>
      <button onClick={() => applyLayout(['b'], ['a'])}>layout</button>
      <span data-testid="ok">{byId('a') && byId('b') ? 'y' : 'n'}</span>
    </div>
  );
}

describe('AppState', () => {
  // Start each case from an explicitly-empty board so the default seed clock
  // (returned by getDials when nothing is stored) doesn't skew the assertions.
  beforeEach(async () => { await storage.setDials([]); });

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

  it('applyLayout assigns zone + order from the two id lists', async () => {
    await storage.setDials([
      { id: 'a', url: 'https://a.com', title: 'A', imageRef: 'letter', color: '#111', order: 0 },
      { id: 'b', url: 'https://b.com', title: 'B', imageRef: 'letter', color: '#222', order: 1 },
    ]);
    render(<AppProvider><LayoutProbe /></AppProvider>);
    await waitFor(() => screen.getByText('layout'));
    fireEvent.click(screen.getByText('layout'));
    // b -> top@0, a -> grid@0
    await waitFor(() => expect(screen.getByTestId('zones').textContent).toBe('a:grid:0,b:top:0'));
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
