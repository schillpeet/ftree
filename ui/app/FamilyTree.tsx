'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import {
  getFamilies,
  updateFamilyMemberPlacement,
  type FamilySummary,
  type Member,
  type Placement,
} from '../lib/api/generated/members';
import Dashboard, { type DashboardPanel } from './Dashboard';
import FamiliesPanel from './FamiliesPanel';
import type { FamilyCardMode } from './FamilyCard';
import MemberSearch from './MemberSearch';
import MembersControls from './MembersControls';
import Scene, { type Focus } from './Scene';
import { useT } from './i18n';
import LiveToasts from './live/LiveToasts';
import { onLiveEvent } from './live/liveBus';
import FollowChip from './live/FollowChip';
import { usePeople, useShareOwnEmail } from './live/people';
import PresenceBar from './live/PresenceBar';
import { followTarget } from './live/presence';
import { useTreeEvents } from './live/useTreeEvents';
import { OpenFamily, useCan, useMe } from './Permissions';
import { can } from './access';
import { emptyTreeOf, familyOfSlug, firstFamily, homePath, pathOf } from './slugRoute';
import EmptyTree from './EmptyTree';
import TreeNotFound from './TreeNotFound';

// Shares the members between the scene's scrolls and the list/form overlay. Rendered by the `(tree)` layout, so it
// stays mounted while the URL switches between trees; the open tree is the one the URL's slug names.
export default function FamilyTree() {
  const t = useT();
  const me = useMe();
  const router = useRouter();
  const { slug: urlSlug } = useParams<{ slug?: string }>();
  // Only admins and people who may create trees, who may have several families, get the families board.
  const canCreate = useCan('family.create');
  const [members, setMembers] = useState<Member[] | null>(null);
  const [families, setFamilies] = useState<FamilySummary[] | null>(null);
  // The tree just chosen here, shown before the URL follows; `slug: undefined` is `/` with no tree.
  const [pending, setPending] = useState<{ slug: string | undefined } | null>(null);
  // Set when the families board hides the only shown tree, so `/` does not lead on to the first one again.
  const [hidden, setHidden] = useState(false);
  const [isLoadingFamilies, setIsLoadingFamilies] = useState(true);
  const [familiesError, setFamiliesError] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [panel, setPanel] = useState<DashboardPanel | null>(null);
  const [familyCard, setFamilyCard] = useState<FamilyCardMode | null>(null);
  // A new object per "Add member" in the menu.
  const [addRequest, setAddRequest] = useState<object | null>(null);
  const [focus, setFocus] = useState<Focus>(null);
  // A new object per click, so clicking the same scroll again reopens the profile.
  const [profile, setProfile] = useState<Focus>(null);
  const [shownId, setShownId] = useState<string | null>(null);
  const [isEditingShown, setIsEditingShown] = useState(false);
  const onShownChange = useCallback((id: string | null, editing: boolean) => {
    setShownId(id);
    setIsEditingShown(editing);
  }, []);

  useShareOwnEmail(me?.email);
  const people = usePeople();
  // The email whose person the camera follows, the member last flown to for them, and whether the panel showed it
  // since: once it did, showing anyone else is the user's own navigation and ends following.
  const [following, setFollowing] = useState<{ email: string; flownTo: string | null; arrived: boolean } | null>(null);
  const target = following && followTarget(people, following.email);
  if (following && target === undefined) {
    setFollowing(null);
  } else if (following && target && target !== following.flownTo) {
    setFollowing({ ...following, flownTo: target, arrived: false });
    setFocus({ id: target });
    setProfile({ id: target });
  } else if (following?.flownTo && !following.arrived && shownId === following.flownTo) {
    setFollowing({ ...following, arrived: true });
  } else if (following?.arrived && shownId !== following.flownTo) {
    setFollowing(null);
  }
  const stopFollowing = () => setFollowing(null);

  if (pending && pending.slug === urlSlug) setPending(null);
  const slug = pending ? pending.slug : urlSlug;
  const activeFamily = families ? familyOfSlug(families, slug) : null;
  const activeFamilyId = activeFamily?.id ?? null;

  // Whatever belongs to the previous tree goes when another one opens, also by back/forward or a typed URL.
  const [openedFamilyId, setOpenedFamilyId] = useState(activeFamilyId);
  if (openedFamilyId !== activeFamilyId) {
    setOpenedFamilyId(activeFamilyId);
    forgetOpenFamily();
  }

  function forgetOpenFamily() {
    setMembers(null);
    setFocus(null);
    setProfile(null);
    setFamilyCard(null);
    setAddRequest(null);
    setFollowing(null);
  }

  // `quiet` keeps the board as it is while the families load again.
  async function loadFamilies(quiet = false) {
    if (!quiet) {
      setIsLoadingFamilies(true);
      setFamiliesError(false);
    }
    try {
      const response = await getFamilies();
      if (response.status !== 200 || !Array.isArray(response.data)) {
        throw new Error('Unexpected families response');
      }
      const loaded = response.data;
      setFamilies(loaded);
      // A tree that went away (deleted) leads on like `/`, to "default" or the first family.
      if (activeFamilyId && !loaded.some((family) => family.id === activeFamilyId)) {
        setPending({ slug: firstFamily(loaded)?.slug });
        router.replace(homePath(loaded) ?? '/');
      }
    } catch {
      if (!quiet) setFamiliesError(true);
    } finally {
      if (!quiet) setIsLoadingFamilies(false);
    }
  }

  // Someone renamed, restyled, or deleted the open tree, or the stream reopened: the family list may have changed.
  const onFamilyLive = useEffectEvent(() => void loadFamilies(true));
  useEffect(
    () =>
      onLiveEvent((event) => {
        if (event.kind === 'family-changed' || event.kind === 'resync') onFamilyLive();
      }),
    [],
  );

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

  // `/` leads on to the first visible tree, replacing itself so the back button skips it.
  useEffect(() => {
    if (slug !== undefined || hidden || !families) return;
    const home = homePath(families);
    if (home) router.replace(home);
  }, [slug, hidden, families, router]);

  // Opens a tree (null: none) by its URL; `card` is the family card to show there.
  function selectFamily(familyId: string | null, card: FamilyCardMode | null = null) {
    if (familyId === activeFamilyId) {
      if (card) setFamilyCard(card);
      return;
    }
    const family = familyId === null ? null : families?.find((item) => item.id === familyId);
    if (family === undefined) return;
    openFamily(family, card);
  }

  function openFamily(family: FamilySummary | null, card: FamilyCardMode | null = null) {
    // Cleared here rather than on arrival, so the card chosen for the new tree survives.
    setOpenedFamilyId(family?.id ?? null);
    forgetOpenFamily();
    setFamilyCard(card);
    setHidden(family === null);
    setPending({ slug: family?.slug });
    router.push(family ? pathOf(family) : '/');
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

  function addMember() {
    stopFollowing();
    setIsMenuOpen(false);
    setPanel(null);
    setAddRequest({});
  }

  function addFamily(family: FamilySummary, card: FamilyCardMode | null = null) {
    setFamilies((current) => [...(current ?? []).filter((item) => item.id !== family.id), family]);
    openFamily(family, card);
  }

  // An unknown, invisible or reserved slug says so instead of showing an empty tree.
  const notFound = families !== null && slug !== undefined && !activeFamily;
  const emptyTree = emptyTreeOf(families, slug, activeFamily, members);
  const canPlace = can(me, 'member.edit', activeFamily);
  useTreeEvents(activeFamilyId, shownId, isEditingShown ? shownId : null);

  return (
    <OpenFamily family={activeFamily ?? null}>
      <Scene
        familyId={activeFamilyId}
        members={members ?? []}
        focus={focus}
        highlight={shownId}
        onOpen={(id) => {
          stopFollowing();
          setProfile({ id });
        }}
        onPlace={canPlace ? (id, placement) => void placeMember(id, placement) : undefined}
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
        onAddMember={addMember}
        onFamilyClick={() => {
          if (activeFamilyId) return setFamilyCard((current) => current ?? 'view');
          if (!canCreate) return;
          setIsMenuOpen(true);
          setPanel('families');
        }}
      />
      {activeFamilyId && (
        <PresenceBar
          members={members ?? []}
          following={following?.email ?? null}
          onFollow={(email) => setFollowing((current) => (current?.email === email ? null : { email, flownTo: null, arrived: false }))}
        />
      )}
      {activeFamilyId && following && <FollowChip email={following.email} onStop={stopFollowing} />}
      {activeFamilyId && <LiveToasts members={members ?? []} editingId={isEditingShown ? shownId : null} />}
      {notFound && <TreeNotFound home={homePath(families)} />}
      {emptyTree && (
        <EmptyTree
          kind={emptyTree}
          onCreate={() => setFamilyCard('create')}
          onImport={() => {
            setIsMenuOpen(true);
            setPanel('families');
          }}
          onAddPerson={addMember}
        />
      )}
      <MemberSearch
        members={members ?? []}
        onSelect={(id) => {
          stopFollowing();
          setIsMenuOpen(false);
          setPanel(null);
          setFocus({ id });
          setProfile({ id });
        }}
      />
      <MembersControls
        key={activeFamilyId ?? 'no-family'}
        familyId={activeFamilyId}
        family={activeFamily ?? undefined}
        familyCard={familyCard}
        onFamilyCardChange={setFamilyCard}
        onFamilyCreated={(family) => addFamily(family, familyCard === 'create' ? 'view' : null)}
        members={members}
        setMembers={setMembers}
        profile={profile}
        addRequest={addRequest}
        onSelect={(id) => setFocus({ id })}
        onShownChange={onShownChange}
        onFamiliesChanged={() => void loadFamilies()}
      />
      <FamiliesPanel
        families={families}
        setFamilies={setFamilies}
        activeFamilyId={activeFamilyId}
        isLoading={isLoadingFamilies}
        error={familiesError ? t.families.loadFailed : null}
        isOpen={panel === 'families' && canCreate}
        onClose={() => setPanel(null)}
        onRetry={() => void loadFamilies()}
        onSelect={selectFamily}
        onOpen={(id) => {
          selectFamily(id, 'view');
          setPanel(null);
          setIsMenuOpen(false);
        }}
        onToggleVisibility={toggleFamilyVisibility}
        onAdded={(family) => addFamily(family)}
        onCreate={() => {
          setPanel(null);
          setIsMenuOpen(false);
          setFamilyCard('create');
        }}
      />
    </OpenFamily>
  );
}
