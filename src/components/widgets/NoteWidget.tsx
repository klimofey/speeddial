import { NoteConfig } from '../../lib/types';
import { t } from '../../lib/i18n';

export function NoteRender({ config }: { config: NoteConfig }) {
  return <div class="w-note">{config.text || <span class="w-note-empty">{t('note_placeholder')}</span>}</div>;
}

export function NoteConfigEditor({ config, onChange }: { config: NoteConfig; onChange: (c: NoteConfig) => void }) {
  return (
    <textarea class="w-note-edit" rows={4} value={config.text} placeholder={t('note_placeholder')}
      onInput={(e) => onChange({ text: (e.target as HTMLTextAreaElement).value })} />
  );
}
