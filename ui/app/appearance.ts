import { useSyncExternalStore } from 'react';
import { onStorage } from './i18n';

// How the family tree is drawn; the choice is remembered per browser.
export const APPEARANCES = ['organic', 'organicExperimental', 'experimental'] as const;
export type Appearance = (typeof APPEARANCES)[number];
const APPEARANCE_KEY = 'ftree.appearance';

// The server render has no localStorage and starts with the organic tree.
export function useAppearance() {
  const saved = useSyncExternalStore(onStorage, () => localStorage.getItem(APPEARANCE_KEY), () => null);
  const appearance: Appearance = APPEARANCES.includes(saved as Appearance) ? (saved as Appearance) : 'organic';
  const setAppearance = (next: Appearance) => {
    localStorage.setItem(APPEARANCE_KEY, next);
    // `storage` only fires in other tabs; tell this one too.
    window.dispatchEvent(new StorageEvent('storage', { key: APPEARANCE_KEY }));
  };
  return [appearance, setAppearance] as const;
}
