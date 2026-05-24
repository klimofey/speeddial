import { RecentSite } from '../lib/recent';
import { faviconUrl } from '../lib/images';
import { t } from '../lib/i18n';

interface Props {
  sites: RecentSite[];
  onPin: (site: RecentSite) => void;
  loading?: boolean;
}

const SKELETON_COUNT = 6;

export function RecentRow({ sites, onPin, loading = false }: Props) {
  if (loading) {
    return (
      <div class="recent-row">
        <div class="recent-label">{t('recent')}</div>
        <div class="recent-tiles">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <div class="recent-tile recent-tile--skeleton" key={i} aria-hidden="true">
              <span class="recent-skeleton-dot" />
              <span class="recent-skeleton-bar" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!sites.length) return null;

  return (
    <div class="recent-row">
      <div class="recent-label">Recent</div>
      <div class="recent-tiles">
        {sites.map((s) => (
          <div class="recent-tile" key={s.origin}>
            <a class="recent-link" href={s.url}>
              <img class="recent-favicon" src={faviconUrl(s.url)} alt="" />
              <span class="recent-title">{s.title}</span>
            </a>
            <button class="recent-pin" aria-label={`Pin ${s.title}`} onClick={() => onPin(s)}>+</button>
          </div>
        ))}
      </div>
    </div>
  );
}
