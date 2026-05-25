import { useState } from 'preact/hooks';
import { t } from '../lib/i18n';

// First-run wizard. The footer step is the key one: Chrome's new-tab footer can't be
// hidden by an extension, so we tell the user how to turn it off themselves.
export function Onboarding({ onDone }: { onDone: () => void }) {
  const steps = [
    { title: t('onb_welcome_title'), body: t('onb_welcome_body') },
    { title: t('onb_footer_title'), body: t('onb_footer_body') },
    { title: t('onb_start_title'), body: t('onb_start_body') },
  ];
  const [i, setI] = useState(0);
  const last = i === steps.length - 1;
  return (
    <div class="modal-backdrop">
      <div class="modal onboarding">
        <div class="onb-step">{i + 1} / {steps.length}</div>
        <h3>{steps[i].title}</h3>
        <p class="onb-body">{steps[i].body}</p>
        <div class="modal-actions onb-actions">
          <button class="onb-skip" onClick={onDone}>{t('onb_skip')}</button>
          {i > 0 && <button onClick={() => setI(i - 1)}>{t('onb_back')}</button>}
          {last
            ? <button class="onb-primary" onClick={onDone}>{t('onb_done')}</button>
            : <button class="onb-primary" onClick={() => setI(i + 1)}>{t('onb_next')}</button>}
        </div>
      </div>
    </div>
  );
}
