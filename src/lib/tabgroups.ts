// Reads live tab groups (chrome.tabGroups) and their tabs (chrome.tabs). Only groups
// in currently-open windows are visible — Chrome's saved/closed groups have no stable
// public API. Feature-detected; never throws.

export interface TabGroupView {
  id: number;
  title: string;
  color: string;
  tabs: { title: string; url: string }[];
}

// chrome group colour name -> a CSS colour for the header dot.
const COLORS: Record<string, string> = {
  grey: '#5f6368', blue: '#1a73e8', red: '#d93025', yellow: '#f9ab00', green: '#1e8e3e',
  pink: '#d01884', purple: '#9334e6', cyan: '#007b83', orange: '#fa903e',
};
export function tabGroupColor(name: string): string {
  return COLORS[name] ?? COLORS.grey;
}

function available(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.tabGroups?.query && !!chrome.tabs?.query;
}

export async function getTabGroups(): Promise<TabGroupView[]> {
  if (!available()) return [];
  try {
    const groups = await chrome.tabGroups.query({});
    const out: TabGroupView[] = [];
    for (const g of groups) {
      const tabs = await chrome.tabs.query({ groupId: g.id });
      out.push({
        id: g.id,
        title: g.title ?? '',
        color: g.color ?? 'grey',
        tabs: tabs.filter((t) => !!t.url).map((t) => ({ title: t.title || t.url!, url: t.url! })),
      });
    }
    return out;
  } catch {
    return [];
  }
}
