import { useSyncExternalStore } from 'react';
import { onStorage } from './i18n';

// Whether the TRON animations play; off unless switched on, remembered per browser. They still need the system to allow
// motion (`useReducedMotion`), so switching them on never overrides "reduce motion".
const MOTION_KEY = 'ftree.motion';

export function useMotion() {
  const on = useSyncExternalStore(onStorage, () => localStorage.getItem(MOTION_KEY) === 'on', () => false);
  const setMotion = (next: boolean) => {
    localStorage.setItem(MOTION_KEY, next ? 'on' : 'off');
    // `storage` only fires in other tabs; tell this one too.
    window.dispatchEvent(new StorageEvent('storage', { key: MOTION_KEY }));
  };
  return [on, setMotion] as const;
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

const onReducedMotion = (listener: () => void) => {
  const query = matchMedia(REDUCED_MOTION);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
};

// Whether the system asks for reduced motion; the server render assumes it does not.
export function useReducedMotion() {
  return useSyncExternalStore(onReducedMotion, () => matchMedia(REDUCED_MOTION).matches, () => false);
}
