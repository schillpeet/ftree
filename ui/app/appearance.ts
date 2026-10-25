import { useSyncExternalStore } from 'react';
import { onStorage } from './i18n';
import { useCan, useMeLoaded } from './Permissions';
import { allowedAppearance, type Appearance } from './access';

export { APPEARANCES, type Appearance } from './access';

// How the family tree is drawn; the choice is remembered per browser.
const APPEARANCE_KEY = 'ftree.appearance';

// The server render has no localStorage and starts with the organic tree; without `tree.appearance`
// only the experimental appearance is used, whatever is stored.
export function useAppearance() {
  const saved = useSyncExternalStore(onStorage, () => localStorage.getItem(APPEARANCE_KEY), () => null);
  const mayChoose = useCan('tree.appearance');
  const appearance = allowedAppearance(saved, useMeLoaded() ? mayChoose : null);
  const setAppearance = (next: Appearance) => {
    localStorage.setItem(APPEARANCE_KEY, next);
    // `storage` only fires in other tabs; tell this one too.
    window.dispatchEvent(new StorageEvent('storage', { key: APPEARANCE_KEY }));
  };
  return [appearance, setAppearance] as const;
}
