// Thin wrappers over chrome.bookmarks. Feature-detected (returns [] when the API or
// permission is absent); never throws.

export interface BookmarkLink { id: string; title: string; url: string; }
export interface BookmarkFolder { id: string; title: string; depth: number; }

interface BmNode { id: string; title: string; url?: string; children?: BmNode[]; }

function api(): { getTree(): Promise<BmNode[]>; getChildren(id: string): Promise<BmNode[]> } | null {
  const g = globalThis as unknown as { chrome?: { bookmarks?: unknown } };
  return (g.chrome?.bookmarks as never) ?? null;
}

// Flattened list of folders (for the config picker), depth-indented. Skips the root.
export async function listFolders(): Promise<BookmarkFolder[]> {
  const bm = api();
  if (!bm) return [];
  try {
    const tree = await bm.getTree();
    const out: BookmarkFolder[] = [];
    const walk = (nodes: BmNode[], depth: number) => {
      for (const n of nodes) {
        if (n.url) continue; // a link, not a folder
        const isRoot = n.id === '0';
        if (!isRoot) out.push({ id: n.id, title: n.title || '—', depth });
        // The synthetic root ('0') isn't a real level — keep its children at depth 0.
        if (n.children) walk(n.children, isRoot ? depth : depth + 1);
      }
    };
    walk(tree, 0);
    return out;
  } catch {
    return [];
  }
}

// Direct link children of a folder (default: the bookmarks bar, id '1').
export async function listBookmarks(folderId: string): Promise<BookmarkLink[]> {
  const bm = api();
  if (!bm) return [];
  try {
    const children = await bm.getChildren(folderId || '1');
    return children.filter((c) => !!c.url).map((c) => ({ id: c.id, title: c.title, url: c.url! }));
  } catch {
    return [];
  }
}
