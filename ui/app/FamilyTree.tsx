'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getFamilies,
  updateFamilyMemberPlacement,
  type FamilySummary,
  type Member,
  type Placement,
} from '../lib/api/generated/members';
import Dashboard, { type DashboardPanel } from './Dashboard';
import FamiliesPanel from './FamiliesPanel';
import MemberSearch from './MemberSearch';
import MembersControls from './MembersControls';
import Scene, { type Focus } from './Scene';
import RandomFamilyPanel from './RandomFamilyPanel';
import { useT } from './i18n';

const firstFamilyId = (items: FamilySummary[]) =>
  items.find((family) => family.name.toLocaleLowerCase() === 'default')?.id ?? items[0]?.id ?? null;

// Shares the members between the scene's scrolls and the list/form overlay.
export default function FamilyTree() {
  const t = useT();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [families, setFamilies] = useState<FamilySummary[] | null>(null);
  const [activeFamilyId, setActiveFamilyId] = useState<string | null>(null);
  const [isLoadingFamilies, setIsLoadingFamilies] = useState(true);
  const [familiesError, setFamiliesError] = useState(false);
  const [openBoard, setOpenBoard] = useState<'random-family' | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [panel, setPanel] = useState<DashboardPanel | null>(null);
  const [focus, setFocus] = useState<Focus>(null);
  // A new object per click, so clicking the same scroll again reopens the profile.
  const [profile, setProfile] = useState<Focus>(null);
  const [shownId, setShownId] = useState<string | null>(null);

  const loadFamilies = useCallback(async () => {
    setIsLoadingFamilies(true);
    setFamiliesError(false);
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
      setFamiliesError(true);
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
        const loaded = response.data;
        setFamilies(loaded);
        setActiveFamilyId((selected) =>
          selected && loaded.some((family) => family.id === selected) ? selected : firstFamilyId(loaded),
        );
      } catch {
        if (current) setFamiliesError(true);
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
    setFamilies((current) => [...(current ?? []).filter((item) => item.id !== family.id), family]);
    selectFamily(family.id);
  }

  const activeFamily = families?.find((family) => family.id === activeFamilyId);

  return (
    <>
      <Scene
        familyId={activeFamilyId}
        members={members ?? []}
        focus={focus}
        highlight={shownId}
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
      <Dashboard
        isOpen={isMenuOpen}
        panel={panel}
        families={families}
        activeFamilyId={activeFamilyId}
        onToggle={() => {
          setIsMenuOpen((open) => !open);
          setPanel(null);
        }}
        onPanel={(next) => setPanel((current) => (current === next ? null : next))}
      />
      <MemberSearch
        members={members ?? []}
        onSelect={(id) => {
          setIsMenuOpen(false);
          setPanel(null);
          setFocus({ id });
          setProfile({ id });
        }}
      />
      <MembersControls
        key={activeFamilyId ?? 'no-family'}
        familyId={activeFamilyId}
        familyName={activeFamily?.name ?? null}
        isDefaultFamily={activeFamily?.name.toLocaleLowerCase() === 'default'}
        members={members}
        setMembers={setMembers}
        profile={profile}
        isListOpen={panel === 'people'}
        onListOpenChange={(open) => setPanel(open ? 'people' : null)}
        onSelect={(id) => setFocus({ id })}
        onShownChange={setShownId}
        onFamiliesChanged={() => void loadFamilies()}
        onBack={() => setPanel('families')}
      />
      <FamiliesPanel
        families={families}
        setFamilies={setFamilies}
        activeFamilyId={activeFamilyId}
        isLoading={isLoadingFamilies}
        error={familiesError ? t.families.loadFailed : null}
        isOpen={panel === 'families'}
        onClose={() => setPanel(null)}
        onRetry={() => void loadFamilies()}
        onSelect={selectFamily}
        onChosen={() => setPanel('people')}
        onToggleVisibility={toggleFamilyVisibility}
        onImported={addFamily}
      />
    </>
  );
}
