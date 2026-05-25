import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { listBookmarks, listFolders } from '../src/lib/bookmarks';
import { BookmarksRender, BookmarksConfigEditor } from '../src/components/widgets/BookmarksWidget';
import { mockChrome } from './setup';

const tree = [{ id: '0', title: '', children: [
  { id: '1', title: 'Bar', children: [
    { id: 'b1', title: 'GitHub', url: 'https://github.com' },
    { id: 'f2', title: 'Dev', children: [{ id: 'b2', title: 'Vite', url: 'https://vitejs.dev' }] },
  ] },
] }];

beforeEach(() => {
  mockChrome.bookmarks.getTree.mockResolvedValue(tree as never);
  mockChrome.bookmarks.getChildren.mockImplementation((async (id: string) =>
    id === '1' ? [{ id: 'b1', title: 'GitHub', url: 'https://github.com' }, { id: 'f2', title: 'Dev' }] : []) as never);
});

describe('bookmarks lib', () => {
  it('listFolders flattens folders (skips the root, indents by depth)', async () => {
    const f = await listFolders();
    expect(f.map((x) => x.id)).toEqual(['1', 'f2']);
    expect(f.find((x) => x.id === 'f2')?.depth).toBe(1);
  });
  it('listBookmarks returns only link children of a folder', async () => {
    const items = await listBookmarks('1');
    expect(items).toEqual([{ id: 'b1', title: 'GitHub', url: 'https://github.com' }]);
  });
});

describe('BookmarksWidget', () => {
  it('shows links when permission is granted', async () => {
    mockChrome.permissions.contains.mockResolvedValue(true as never);
    render(<BookmarksRender config={{ folderId: '1' }} />);
    await waitFor(() => expect(screen.getByText('GitHub')).toBeTruthy());
  });

  it('shows a grant button when permission is missing, then loads after granting', async () => {
    mockChrome.permissions.contains.mockResolvedValue(false as never);
    mockChrome.permissions.request.mockResolvedValue(true as never);
    render(<BookmarksRender config={{ folderId: '1' }} />);
    await waitFor(() => screen.getByText('Allow access'));
    fireEvent.click(screen.getByText('Allow access'));
    await waitFor(() => expect(screen.getByText('GitHub')).toBeTruthy());
  });

  it('config editor lists folders and emits the chosen folder', async () => {
    mockChrome.permissions.contains.mockResolvedValue(true as never);
    const onChange = vi.fn();
    render(<BookmarksConfigEditor config={{ folderId: '1' }} onChange={onChange} />);
    await waitFor(() => screen.getByText(/Dev/)); // wait for folders to load into the select
    fireEvent.change(screen.getByLabelText('Folder'), { target: { value: 'f2' } });
    expect(onChange).toHaveBeenCalledWith({ folderId: 'f2' });
  });
});
