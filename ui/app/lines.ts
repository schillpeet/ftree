import { useSyncExternalStore } from 'react';
import { onStorage } from './i18n';

// Whether the relation lines between the cards are drawn; the choice is remembered per browser.
const LINES_KEY = 'ftree.showLines';

// The server render has no localStorage and starts with the lines shown.
export function useShowLines() {
  const saved = useSyncExternalStore(onStorage, () => localStorage.getItem(LINES_KEY), () => null);
  const showLines = saved !== 'false';
  const setShowLines = (next: boolean) => {
    localStorage.setItem(LINES_KEY, String(next));
    // `storage` only fires in other tabs; tell this one too.
    window.dispatchEvent(new StorageEvent('storage', { key: LINES_KEY }));
  };
  return [showLines, setShowLines] as const;
}
