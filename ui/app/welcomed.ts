// Which shared trees greeted the user already, remembered per browser. The decision is pure, so `welcomed.check.mjs` can
// test it without a browser; the hook only reads and writes `localStorage` like `appearance.ts`.
import { useSyncExternalStore } from 'react';
import type { FamilySummary } from '../lib/api/generated/members';

const WELCOMED_KEY = 'ftree.welcomedTrees';

// Whether the invitation card greets the user in this tree: they did not create it (not its owner) and it has not greeted
// them in this browser yet. An admin's view of a tree has no role in it of its own and is never greeted.
export function needsWelcome(family: Pick<FamilySummary, 'id' | 'role'> | null, welcomed: readonly string[]): boolean {
  if (!family || !family.role || family.role === 'owner' || family.role === 'admin') return false;
  return !welcomed.includes(family.id);
}

function parse(raw: string | null): string[] {
  try {
    const value: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

const subscribe = (listener: () => void) => {
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
};

const EMPTY: string[] = [];
let cache: { raw: string | null; list: string[] } = { raw: null, list: EMPTY };

// The snapshot has to be the same array while the stored text is unchanged.
function read(): string[] {
  const raw = localStorage.getItem(WELCOMED_KEY);
  if (raw !== cache.raw) cache = { raw, list: parse(raw) };
  return cache.list;
}

// The server render has nothing stored; the second entry remembers a tree.
export function useWelcomed(): [string[], (familyId: string) => void] {
  const welcomed = useSyncExternalStore(subscribe, read, () => EMPTY);
  const markWelcomed = (familyId: string) => {
    const current = read();
    if (current.includes(familyId)) return;
    localStorage.setItem(WELCOMED_KEY, JSON.stringify([...current, familyId]));
    // `storage` only fires in other tabs; tell this one too.
    window.dispatchEvent(new StorageEvent('storage', { key: WELCOMED_KEY }));
  };
  return [welcomed, markWelcomed];
}
