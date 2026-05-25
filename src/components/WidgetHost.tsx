import { WidgetInstance, Settings } from '../lib/types';
import { getWidget } from './widgets/registry';

export function WidgetHost({ widget, settings }: { widget: WidgetInstance; settings: Settings }) {
  const def = getWidget(widget.type);
  if (!def) return <div class="w-unknown">?</div>;
  const Render = def.Render;
  return <Render config={widget.config as never} settings={settings} />;
}
