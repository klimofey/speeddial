import { WIDGETS } from './registry';
import { WidgetType } from '../../lib/types';
import { t } from '../../lib/i18n';

interface Props { onAddLink: () => void; onAddWidget: (type: WidgetType) => void; onClose: () => void; }

export function Store({ onAddLink, onAddWidget, onClose }: Props) {
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t('store_title')}</h3>
        <div class="store-grid">
          <button class="store-item" onClick={onAddLink}><span class="store-icon">🔗</span>{t('widget_link')}</button>
          {WIDGETS.map((w) => (
            <button class="store-item" key={w.type} onClick={() => onAddWidget(w.type)}>
              <span class="store-icon">{w.icon}</span>{t(w.nameKey)}
            </button>
          ))}
          <button class="store-item" disabled><span class="store-icon">☁️</span>Weather <em>({t('coming_soon')})</em></button>
        </div>
        <div class="modal-actions"><button onClick={onClose}>{t('close')}</button></div>
      </div>
    </div>
  );
}
