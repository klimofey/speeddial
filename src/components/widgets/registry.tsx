import { ComponentType } from 'preact';
import { WidgetType, WidgetInstance, Settings, NoteConfig, ClockConfig, TranslatorConfig, BookmarksConfig } from '../../lib/types';
import { NoteRender, NoteConfigEditor } from './NoteWidget';
import { ClockRender, ClockConfigEditor } from './ClockWidget';
import { TranslatorRender, TranslatorConfigEditor } from './TranslatorWidget';
import { BookmarksRender, BookmarksConfigEditor } from './BookmarksWidget';
import { TabGroupsRender, TabGroupsConfigEditor } from './TabGroupsWidget';

export interface WidgetDef {
  type: WidgetType;
  nameKey: string;
  icon: string;
  defaultSize: { w: number; h: number };
  defaultConfig: WidgetInstance['config'];
  Render: ComponentType<{ config: never; settings: Settings }>;
  ConfigEditor: ComponentType<{ config: never; onChange: (c: never) => void }>;
}

const noteDefault: NoteConfig = { text: '' };
const clockDefault: ClockConfig = { timeZone: '', label: '', showGreeting: true, format: '24h' };
const translatorDefault: TranslatorConfig = { target: 'en', cloudFallback: false };
const bookmarksDefault: BookmarksConfig = { folderId: '' };

export const WIDGETS: WidgetDef[] = [
  { type: 'note', nameKey: 'widget_note', icon: '📝', defaultSize: { w: 2, h: 1 }, defaultConfig: noteDefault,
    Render: NoteRender as unknown as WidgetDef['Render'], ConfigEditor: NoteConfigEditor as unknown as WidgetDef['ConfigEditor'] },
  { type: 'clock', nameKey: 'widget_clock', icon: '🕐', defaultSize: { w: 2, h: 1 }, defaultConfig: clockDefault,
    Render: ClockRender as unknown as WidgetDef['Render'], ConfigEditor: ClockConfigEditor as unknown as WidgetDef['ConfigEditor'] },
  { type: 'translator', nameKey: 'widget_translator', icon: '🌐', defaultSize: { w: 2, h: 2 }, defaultConfig: translatorDefault,
    Render: TranslatorRender as unknown as WidgetDef['Render'], ConfigEditor: TranslatorConfigEditor as unknown as WidgetDef['ConfigEditor'] },
  { type: 'bookmarks', nameKey: 'widget_bookmarks', icon: '🔖', defaultSize: { w: 2, h: 2 }, defaultConfig: bookmarksDefault,
    Render: BookmarksRender as unknown as WidgetDef['Render'], ConfigEditor: BookmarksConfigEditor as unknown as WidgetDef['ConfigEditor'] },
  { type: 'tabgroups', nameKey: 'widget_tabgroups', icon: '🗂️', defaultSize: { w: 2, h: 2 }, defaultConfig: {},
    Render: TabGroupsRender as unknown as WidgetDef['Render'], ConfigEditor: TabGroupsConfigEditor as unknown as WidgetDef['ConfigEditor'] },
];

export function getWidget(type: WidgetType): WidgetDef | undefined {
  return WIDGETS.find((w) => w.type === type);
}
