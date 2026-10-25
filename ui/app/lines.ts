import { useSyncExternalStore } from 'react';
import { onStorage } from './i18n';

// Whether the relation lines between the cards are drawn; the choice is remembered per browser.
const LINES_KEY = 'ftree.showLines';
// Whether the lines to the core family of the person whose panel is open stand out.
const HIGHLIGHT_KEY = 'ftree.highlightRelatives';
// Whether the lines to that person's blood relatives stand out in the experimental view.
const BLOOD_KEY = 'ftree.highlightBlood';
// Whether the experimental view shows the key to its lines and symbols; it does until the user closes it.
const LEGEND_KEY = 'ftree.showLegend';
// Whether that legend is folded to its header; it starts folded so it does not cover the tree.
const LEGEND_FOLDED_KEY = 'ftree.legendFolded';

// The server render has no localStorage and starts with `fallback`, as does a browser that never chose.
function useStoredSwitch(key: string, fallback = true) {
  const saved = useSyncExternalStore(onStorage, () => localStorage.getItem(key), () => null);
  const value = saved == null ? fallback : saved === 'true';
  const setValue = (next: boolean) => {
    localStorage.setItem(key, String(next));
    // `storage` only fires in other tabs; tell this one too.
    window.dispatchEvent(new StorageEvent('storage', { key }));
  };
  return [value, setValue] as const;
}

export const useShowLines = () => useStoredSwitch(LINES_KEY);
export const useHighlightCoreFamily = () => useStoredSwitch(HIGHLIGHT_KEY);
export const useHighlightBlood = () => useStoredSwitch(BLOOD_KEY, false);
export const useShowLegend = () => useStoredSwitch(LEGEND_KEY);
export const useLegendFolded = () => useStoredSwitch(LEGEND_FOLDED_KEY);
