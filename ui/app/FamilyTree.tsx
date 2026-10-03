'use client';

import { useCallback, useEffect, useState } from 'react';
import { getFamilies, type FamilySummary, type Member } from '../lib/api/generated/members';
import FamiliesPanel from './FamiliesPanel';
import MembersControls from './MembersControls';
import Scene, { type Focus } from './Scene';
import TestUsersPanel from './TestUsersPanel';

// Shares the members between the scene's scrolls and the list/form overlay.
export default function FamilyTree() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [families, setFamilies] = useState<FamilySummary[] | null>(null);
  const [activeFamilyId, setActiveFamilyId] = useState<string | null>(null);
  const [isLoadingFamilies, setIsLoadingFamilies] = useState(true);
  const [familiesError, setFamiliesError] = useState<string | null>(null);
  const [openBoard, setOpenBoard] = useState<'families' | 'test-users' | null>(null);
  const [focus, setFocus] = useState<Focus>(null);
  // A new object per click, so clicking the same scroll again reopens the profile.
  const [profile, setProfile] = useState<Focus>(null);

  const loadFamilies = useCallback(async () => {
    setIsLoadingFamilies(true);
    setFamiliesError(null);
    try {
      const response = await getFamilies();
      if (response.status !== 200 || !Array.isArray(response.data)) {
        throw new Error('Unexpected families response');
      }
      setFamilies(response.data);
      setActiveFamilyId((current) =>
        current && response.data.some((family) => family.id === current) ? current : response.data[0]?.id ?? null,
      );
    } catch {
      setFamiliesError('Die Familien konnten nicht geladen werden. Ist das BFF erreichbar?');
    } finally {
      setIsLoadingFamilies(false);
    }
  }, []);

  useEffect(() => {
    let current = true;
    async function loadInitialFamilies() {
      try {
        const response = await getFamilies();
        if (!current) return;
        if (response.status !== 200 || !Array.isArray(response.data)) {
          throw new Error('Unexpected families response');
        }
        setFamilies(response.data);
        setActiveFamilyId((selected) =>
          selected && response.data.some((family) => family.id === selected)
            ? selected
            : response.data[0]?.id ?? null,
        );
      } catch {
        if (current) setFamiliesError('Die Familien konnten nicht geladen werden. Ist das BFF erreichbar?');
      } finally {
        if (current) setIsLoadingFamilies(false);
      }
    }
    void loadInitialFamilies();
    return () => {
      current = false;
    };
  }, []);

  function selectFamily(familyId: string | null) {
    setMembers(null);
    setFocus(null);
    setProfile(null);
    setActiveFamilyId(familyId);
  }

  function addFamily(family: FamilySummary) {
    setFamilies((current) => [...(current ?? []).filter((item) => item.id !== family.id), family]);
    selectFamily(family.id);
  }

  return (
    <>
      <Scene members={members ?? []} focus={focus} onOpen={(id) => setProfile({ id })} />
      <FamiliesPanel
        families={families}
        setFamilies={setFamilies}
        activeFamilyId={activeFamilyId}
        isLoading={isLoadingFamilies}
        error={familiesError}
        isOpen={openBoard === 'families'}
        onToggle={() => setOpenBoard((open) => open === 'families' ? null : 'families')}
        onRetry={() => void loadFamilies()}
        onSelect={selectFamily}
      />
      <MembersControls
        key={activeFamilyId ?? 'no-family'}
        familyId={activeFamilyId}
        members={members}
        setMembers={setMembers}
        profile={profile}
        onSelect={(id) => setFocus({ id })}
        onFamiliesChanged={() => void loadFamilies()}
      />
      <TestUsersPanel
        families={families}
        isOpen={openBoard === 'test-users'}
        onToggle={() => setOpenBoard((open) => open === 'test-users' ? null : 'test-users')}
        onCreated={addFamily}
      />
    </>
  );
}
