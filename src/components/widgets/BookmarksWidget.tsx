import { useEffect, useState } from 'preact/hooks';
import { BookmarksConfig } from '../../lib/types';
import { listBookmarks, listFolders, BookmarkLink, BookmarkFolder } from '../../lib/bookmarks';
import { hasBookmarksPermission, ensureBookmarksPermission } from '../../lib/permissions';
import { faviconUrl } from '../../lib/images';
import { t } from '../../lib/i18n';

export function BookmarksRender({ config }: { config: BookmarksConfig }) {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [items, setItems] = useState<BookmarkLink[]>([]);

  const load = async () => setItems(await listBookmarks(config.folderId));

  useEffect(() => {
    let alive = true;
    void (async () => {
      const ok = await hasBookmarksPermission();
      if (!alive) return;
      setGranted(ok);
      if (ok) await load();
    })();
    return () => { alive = false; };
  }, [config.folderId]);

  if (granted === false) {
    return (
      <div class="w-bm w-bm-center">
        <button class="w-grant" onClick={async () => {
          if (await ensureBookmarksPermission()) { setGranted(true); await load(); }
        }}>{t('allow_access')}</button>
      </div>
    );
  }
  return (
    <div class="w-bm">
      {items.length === 0
        ? <span class="w-bm-empty">{t('bm_empty')}</span>
        : items.map((b) => (
          <a class="w-bm-item" href={b.url} key={b.id} title={b.title || b.url}>
            <img class="w-bm-fav" src={faviconUrl(b.url)} alt="" />
            <span class="w-bm-title">{b.title || b.url}</span>
          </a>
        ))}
    </div>
  );
}

export function BookmarksConfigEditor({ config, onChange }: { config: BookmarksConfig; onChange: (c: BookmarksConfig) => void }) {
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      const ok = await hasBookmarksPermission();
      setGranted(ok);
      if (ok) setFolders(await listFolders());
    })();
  }, []);

  if (granted === false) {
    return (
      <div class="w-bm-edit">
        <button class="w-grant" onClick={async () => {
          if (await ensureBookmarksPermission()) { setGranted(true); setFolders(await listFolders()); }
        }}>{t('allow_access')}</button>
      </div>
    );
  }
  return (
    <div class="w-bm-edit">
      <label for="bm-folder">{t('bm_folder')}</label>
      <select id="bm-folder" value={config.folderId}
        onChange={(e) => onChange({ folderId: (e.target as HTMLSelectElement).value })}>
        {folders.map((f) => (
          <option value={f.id} key={f.id}>{`${'  '.repeat(f.depth)}${f.title}`}</option>
        ))}
      </select>
    </div>
  );
}
