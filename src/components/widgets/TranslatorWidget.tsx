import { useEffect, useRef, useState } from 'preact/hooks';
import { TranslatorConfig } from '../../lib/types';
import { translate, TranslateResult, TRANSLATE_LANGS } from '../../lib/translate';
import { ensureMyMemoryPermission } from '../../lib/permissions';
import { t } from '../../lib/i18n';

export function TranslatorRender({ config }: { config: TranslatorConfig }) {
  const [input, setInput] = useState('');
  const [out, setOut] = useState<TranslateResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    if (!input.trim()) { setOut(null); return; }
    timer.current = setTimeout(async () => {
      setBusy(true); setProgress(null);
      const r = await translate(input, config.target, {
        cloudFallback: config.cloudFallback,
        onDownload: (p) => setProgress(Math.round(p * 100)),
      });
      setOut(r); setBusy(false); setProgress(null);
    }, 500);
    return () => clearTimeout(timer.current);
  }, [input, config.target, config.cloudFallback]);

  return (
    <div class="w-translate">
      <textarea class="w-translate-in" rows={2} value={input} placeholder={t('translate_placeholder')}
        onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)} />
      <div class="w-translate-out">
        {busy && <span class="w-translate-status">{progress != null ? `${t('downloading_model')} ${progress}%` : t('translating')}</span>}
        {!busy && out?.via === 'none' && <span class="w-translate-status">{t('translator_unavailable')}</span>}
        {!busy && out && out.via !== 'none' && (
          <>
            <span class="w-translate-detected">{t('detected')}: {out.source || '?'} → {config.target}{out.via === 'cloud' ? ' ☁' : ''}</span>
            <div class="w-translate-text">{out.text}</div>
          </>
        )}
      </div>
    </div>
  );
}

export function TranslatorConfigEditor({ config, onChange }: { config: TranslatorConfig; onChange: (c: TranslatorConfig) => void }) {
  const onCloudToggle = async (checked: boolean) => {
    if (checked) onChange({ ...config, cloudFallback: await ensureMyMemoryPermission() });
    else onChange({ ...config, cloudFallback: false });
  };
  return (
    <div class="w-translate-edit">
      <label for="tr-target">{t('translate_to')}</label>
      <select id="tr-target" value={config.target}
        onChange={(e) => onChange({ ...config, target: (e.target as HTMLSelectElement).value })}>
        {TRANSLATE_LANGS.map((l) => <option value={l.code} key={l.code}>{l.label}</option>)}
      </select>
      <label><input type="checkbox" checked={config.cloudFallback}
        onChange={(e) => onCloudToggle((e.target as HTMLInputElement).checked)} /> {t('cloud_fallback')}</label>
      <p class="settings-warn">{t('cloud_fallback_warn')}</p>
    </div>
  );
}
