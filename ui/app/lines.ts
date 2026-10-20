import { useSyncExternalStore } from 'react';
import { onStorage } from './i18n';

// Whether the relation lines between the cards are drawn; the choice is remembered per browser.
const LINES_KEY = 'ftree.showLines';
// Whether the lines to the relatives of the person whose panel is open stand out.
const HIGHLIGHT_KEY = 'ftree.highlightRelatives';

// The server render has no localStorage and starts with both switches on.
function useStoredSwitch(key: string) {
  const saved = useSyncExternalStore(onStorage, () => localStorage.getItem(key), () => null);
  const value = saved !== 'false';
  const setValue = (next: boolean) => {
    localStorage.setItem(key, String(next));
    // `storage` only fires in other tabs; tell this one too.
    window.dispatchEvent(new StorageEvent('storage', { key }));
  };
  return [value, setValue] as const;
}

export const useShowLines = () => useStoredSwitch(LINES_KEY);
export const useHighlightRelatives = () => useStoredSwitch(HIGHLIGHT_KEY);
