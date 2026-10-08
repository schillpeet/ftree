'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getFamilies,
  updateFamilyMemberPlacement,
  type FamilySummary,
  type Member,
  type Placement,
} from '../lib/api/generated/members';
import FamiliesPanel from './FamiliesPanel';
import MembersControls from './MembersControls';
import Scene, { type Focus } from './Scene';
import RandomFamilyPanel from './RandomFamilyPanel';

const firstFamilyId = (items: FamilySummary[]) =>
  items.find((family) => family.name.toLocaleLowerCase() === 'default')?.id ?? items[0]?.id ?? null;

// Shares the members between the scene's scrolls and the list/form overlay.
export default function FamilyTree() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [families, setFamilies] = useState<FamilySummary[] | null>(null);
  const [activeFamilyId, setActiveFamilyId] = useState<string | null>(null);
  const [isLoadingFamilies, setIsLoadingFamilies] = useState(true);
  const [familiesError, setFamiliesError] = useState<string | null>(null);
  const [openBoard, setOpenBoard] = useState<'families' | 'random-family' | null>(null);
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
      setActiveFamilyId((current) => {
        if (current === null) return null;
        return response.data.some((family) => family.id === current) ? current : firstFamilyId(response.data);
      });
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
        const orderedFamilies = [...response.data].sort((left, right) => {
          const leftIsDefault = left.name.toLocaleLowerCase() === 'default';
          const rightIsDefault = right.name.toLocaleLowerCase() === 'default';
          return Number(rightIsDefault) - Number(leftIsDefault);
        });
        setFamilies(orderedFamilies);
        setActiveFamilyId((selected) =>
          selected && orderedFamilies.some((family) => family.id === selected)
            ? selected
            : firstFamilyId(orderedFamilies),
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
    if (familyId === activeFamilyId) return;
    setMembers(null);
    setFocus(null);
    setProfile(null);
    setActiveFamilyId(familyId);
  }

  function toggleFamilyVisibility(familyId: string) {
    selectFamily(activeFamilyId === familyId ? null : familyId);
  }

  // Optimistic: the card stays where it was dropped and goes back if the BFF refuses (e.g. the
  // pin was taken meanwhile).
  async function placeMember(id: string, placement: Placement) {
    const before = members?.find((m) => m.id === id);
    if (!activeFamilyId || !before) return;
    const replace = (member: Member) => setMembers((current) => current?.map((m) => (m.id === id ? member : m)) ?? null);
    replace({ ...before, ...placement });
    try {
      if ((await updateFamilyMemberPlacement(activeFamilyId, id, placement)).status !== 204) replace(before);
    } catch {
      replace(before);
    }
  }

  function addFamily(family: FamilySummary) {
    setFamilies((current) =>
      [...(current ?? []).filter((item) => item.id !== family.id), family].sort((left, right) => {
        const leftIsDefault = left.name.toLocaleLowerCase() === 'default';
        const rightIsDefault = right.name.toLocaleLowerCase() === 'default';
        return Number(rightIsDefault) - Number(leftIsDefault);
      }),
    );
    selectFamily(family.id);
  }

  return (
    <>
      <Scene
        members={members ?? []}
        focus={focus}
        onOpen={(id) => setProfile({ id })}
        onPlace={(id, placement) => void placeMember(id, placement)}
        debugTools={
          <RandomFamilyPanel
            families={families}
            isOpen={openBoard === 'random-family'}
            onToggle={() => setOpenBoard((open) => open === 'random-family' ? null : 'random-family')}
            onCreated={addFamily}
          />
        }
      />
      <div className="overlay-controls">
        <MembersControls
          key={activeFamilyId ?? 'no-family'}
          familyId={activeFamilyId}
          isDefaultFamily={families?.find((family) => family.id === activeFamilyId)?.name.toLocaleLowerCase() === 'default'}
          members={members}
          setMembers={setMembers}
          profile={profile}
          onSelect={(id) => setFocus({ id })}
          onFamiliesChanged={() => void loadFamilies()}
        />
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
          onToggleVisibility={toggleFamilyVisibility}
        />
      </div>
    </>
  );
}
