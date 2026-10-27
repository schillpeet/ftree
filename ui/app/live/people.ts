'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { othersAt, peopleOf } from './presence';
import { usePresent } from './useTreeEvents';

// The signed-in email beside the presence store: drei's <Html> roots get no context, so the dots at the cards cannot
// call useMe() to leave out the own tabs.
let ownEmail: string | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Called once where useMe() works, by FamilyTree.
export function useShareOwnEmail(email: string | null | undefined) {
  useEffect(() => {
    ownEmail = email ?? null;
    listeners.forEach((listener) => listener());
  }, [email]);
}

// Everyone in the open tree, one entry per person (`peopleOf`).
export function usePeople() {
  const present = usePresent();
  const email = useSyncExternalStore(subscribe, () => ownEmail, () => null);
  return useMemo(() => peopleOf(present, email), [present, email]);
}

// Everyone else viewing or editing a member (`othersAt`).
export function useOthersAt(memberId: string) {
  const people = usePeople();
  return useMemo(() => othersAt(people, memberId), [people, memberId]);
}
