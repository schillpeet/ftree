'use client';

import { useEffect, useState } from 'react';
import { getFamilies, type FamilySummary, type Me } from '../../lib/api/generated/members';
import { lastTree, rememberTree } from '../lastTree';
import { familyOfSlug, firstFamily } from '../slugRoute';

// The signed-in person's families on the landing page, and the current one: the tree last open in this browser (or the one
// chosen on the families board here), else the one `/start` would open, so the header's `user:family` names the tree "Go to
// the tree" leads to. Nothing is loaded for visitors.
export function useHomeFamilies(me: Me | null | undefined) {
  const [families, setFamilies] = useState<FamilySummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Read lazily: the server render shows no prompt, which waits for the families anyway.
  const [chosen, setChosen] = useState(() => (typeof window === 'undefined' ? null : lastTree()));
  const signedIn = !!me;

  useEffect(() => {
    if (!signedIn) return;
    let current = true;
    getFamilies()
      .then((response) => {
        if (!current) return;
        if (response.status !== 200 || !Array.isArray(response.data)) throw new Error('Unexpected families response');
        setFamilies(response.data);
        setFailed(false);
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [signedIn, attempt]);

  const current = families ? (familyOfSlug(families, chosen ?? undefined) ?? firstFamily(families)) : null;

  function choose(familyId: string | null) {
    const family = families?.find((item) => item.id === familyId);
    if (!family) return;
    rememberTree(family.slug);
    setChosen(family.slug);
  }

  return {
    families,
    setFamilies,
    current,
    isLoading: signedIn && families === null && !failed,
    failed,
    retry: () => {
      setFailed(false);
      setAttempt((value) => value + 1);
    },
    choose,
  };
}
