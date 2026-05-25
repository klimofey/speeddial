import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { Onboarding } from '../src/components/Onboarding';

describe('Onboarding wizard', () => {
  it('steps through to the footer tip and finishes', () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);
    expect(screen.getByText('Welcome to Dialy')).toBeTruthy();
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText(/Hide Chrome/)).toBeTruthy(); // the key footer step
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Make it yours')).toBeTruthy();
    fireEvent.click(screen.getByText('Get started'));
    expect(onDone).toHaveBeenCalled();
  });

  it('Skip finishes immediately', () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);
    fireEvent.click(screen.getByText('Skip'));
    expect(onDone).toHaveBeenCalled();
  });
});
