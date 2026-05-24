import { RecentSite } from '../lib/recent';
import { faviconUrl } from '../lib/images';

interface Props {
  sites: RecentSite[];
  onPin: (site: RecentSite) => void;
}

export function RecentRow({ sites, onPin }: Props) {
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
