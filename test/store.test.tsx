import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { Store } from '../src/components/widgets/Store';

describe('Store', () => {
  it('renders Link, Note, and Clock buttons', () => {
    render(<Store onAddLink={() => {}} onAddWidget={() => {}} onClose={() => {}} />);
    expect(screen.getByText('Link card')).toBeTruthy();
    expect(screen.getByText('Note')).toBeTruthy();
    expect(screen.getByText('Clock')).toBeTruthy();
  });

  it('calls onAddWidget with note when Note button is clicked', () => {
    const onAddWidget = vi.fn();
    render(<Store onAddLink={() => {}} onAddWidget={onAddWidget} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Note'));
    expect(onAddWidget).toHaveBeenCalledWith('note');
  });

  it('calls onAddLink when Link card button is clicked', () => {
    const onAddLink = vi.fn();
    render(<Store onAddLink={onAddLink} onAddWidget={() => {}} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Link card'));
    expect(onAddLink).toHaveBeenCalled();
  });
});
