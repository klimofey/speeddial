import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { getTabGroups, tabGroupColor } from '../src/lib/tabgroups';
import { TabGroupsRender } from '../src/components/widgets/TabGroupsWidget';
import { mockChrome } from './setup';

beforeEach(() => {
  mockChrome.tabGroups.query.mockResolvedValue([
    { id: 1, title: 'Work', color: 'blue' },
    { id: 2, title: 'Reading', color: 'red' },
  ] as never);
  mockChrome.tabs.query.mockImplementation((async (info: { groupId?: number }) =>
    info?.groupId === 2
      ? [{ title: 'HN', url: 'https://news.ycombinator.com' }]
      : [{ title: 'Gmail', url: 'https://mail.google.com' }, { title: 'NoUrl' }]) as never);
});

describe('tabgroups lib', () => {
  it('maps groups to views with only url-bearing tabs', async () => {
    const groups = await getTabGroups();
    expect(groups.map((g) => g.title)).toEqual(['Work', 'Reading']);
    expect(groups[0].tabs).toEqual([{ title: 'Gmail', url: 'https://mail.google.com' }]); // 'NoUrl' dropped
    expect(groups[1].tabs).toEqual([{ title: 'HN', url: 'https://news.ycombinator.com' }]);
  });
  it('tabGroupColor maps known colours and falls back to grey', () => {
    expect(tabGroupColor('blue')).toBe('#1a73e8');
    expect(tabGroupColor('nope')).toBe(tabGroupColor('grey'));
  });
});

describe('TabGroupsWidget', () => {
  it('renders groups and their tabs when granted', async () => {
    mockChrome.permissions.contains.mockResolvedValue(true as never);
    render(<TabGroupsRender />);
    await waitFor(() => expect(screen.getByText('Work')).toBeTruthy());
    expect(screen.getByText('Gmail')).toBeTruthy();
    expect(screen.getByText('Reading')).toBeTruthy();
  });

  it('shows a grant button when permission is missing', async () => {
    mockChrome.permissions.contains.mockResolvedValue(false as never);
    mockChrome.permissions.request.mockResolvedValue(true as never);
    render(<TabGroupsRender />);
    await waitFor(() => screen.getByText('Allow access'));
    fireEvent.click(screen.getByText('Allow access'));
    await waitFor(() => expect(screen.getByText('Work')).toBeTruthy());
  });
});
