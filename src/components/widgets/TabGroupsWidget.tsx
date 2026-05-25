import { useEffect, useState } from 'preact/hooks';
import { getTabGroups, tabGroupColor, TabGroupView } from '../../lib/tabgroups';
import { hasTabGroupsPermission, ensureTabGroupsPermission } from '../../lib/permissions';
import { faviconUrl } from '../../lib/images';
import { t } from '../../lib/i18n';

export function TabGroupsRender() {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [groups, setGroups] = useState<TabGroupView[]>([]);
  const load = async () => setGroups(await getTabGroups());

  useEffect(() => {
    let alive = true;
    void (async () => {
      const ok = await hasTabGroupsPermission();
      if (!alive) return;
      setGranted(ok);
      if (ok) await load();
    })();
    return () => { alive = false; };
  }, []);

  if (granted === false) {
    return (
      <div class="w-tg w-bm-center">
        <button class="w-grant" onClick={async () => {
          if (await ensureTabGroupsPermission()) { setGranted(true); await load(); }
        }}>{t('allow_access')}</button>
      </div>
    );
  }
  return (
    <div class="w-tg">
      {groups.length === 0
        ? <span class="w-bm-empty">{t('tg_empty')}</span>
        : groups.map((g) => (
          <div class="w-tg-group" key={g.id}>
            <div class="w-tg-head">
              <span class="w-tg-dot" style={{ background: tabGroupColor(g.color) }} />
              {g.title || t('tg_untitled')}
            </div>
            {g.tabs.map((tab, i) => (
              <a class="w-bm-item" href={tab.url} key={i} title={tab.title}>
                <img class="w-bm-fav" src={faviconUrl(tab.url)} alt="" />
                <span class="w-bm-title">{tab.title}</span>
              </a>
            ))}
          </div>
        ))}
    </div>
  );
}

export function TabGroupsConfigEditor() {
  const [granted, setGranted] = useState<boolean | null>(null);
  useEffect(() => { void (async () => setGranted(await hasTabGroupsPermission()))(); }, []);
  return (
    <div class="w-tg-edit">
      {granted === false
        ? <button class="w-grant" onClick={async () => { await ensureTabGroupsPermission(); setGranted(await hasTabGroupsPermission()); }}>{t('allow_access')}</button>
        : <p class="settings-warn">{t('tg_note')}</p>}
    </div>
  );
}
