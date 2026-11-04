import { useSyncExternalStore } from 'react';
import { onStorage } from './i18n';

// How much a card in the tree shows, remembered per browser: `s` (slim, the default) name and years, `m` also the full
// name, the birth name, and the dates of birth and death. Everything else stays in the profile.
export type CardDensity = 's' | 'm';
export const CARD_DENSITIES: CardDensity[] = ['s', 'm'];
const DENSITY_KEY = 'ftree.cardDensity';

export function useCardDensity() {
  const density = useSyncExternalStore(
    onStorage,
    (): CardDensity => (localStorage.getItem(DENSITY_KEY) === 'm' ? 'm' : 's'),
    (): CardDensity => 's',
  );
  const setDensity = (next: CardDensity) => {
    localStorage.setItem(DENSITY_KEY, next);
    // `storage` only fires in other tabs; tell this one too.
    window.dispatchEvent(new StorageEvent('storage', { key: DENSITY_KEY }));
  };
  return [density, setDensity] as const;
}
