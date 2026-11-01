'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import {
  clearSelfMember,
  getFamilies,
  updateFamilyMemberPlacement,
  type FamilySummary,
  type Member,
  type Placement,
} from '../lib/api/generated/members';
import Dock, { type CameraView } from './Dock';
import Dashboard, { type DashboardPanel } from './Dashboard';
import FamiliesPanel from './FamiliesPanel';
import type { FamilyCardMode } from './FamilyCard';
import Header from './Header';
import MemberSearch from './MemberSearch';
import MembersControls from './MembersControls';
import { AddedToast } from './QuickAdd';
import ShareDialog from './ShareDialog';
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
import IntroTour from './IntroTour';
import InvitationCard, { InvitationTasks } from './InvitationCard';
import { needsWelcome, useWelcomed } from './welcomed';
import { useTour } from './tour';
import WelcomeCard, { PlantRetry, type PartialPlant } from './WelcomeCard';
import TreeNotFound from './TreeNotFound';

// The slug of the tree last open in this browser, which `/` opens again while it is still visible.
const LAST_TREE_KEY = 'ftree.lastTree';

function lastTree() {
  try {
    return localStorage.getItem(LAST_TREE_KEY);
  } catch {
    return null;
  }
}

// Shares the members between the scene's scrolls and the list/form overlay. Rendered by the `(tree)` layout, so it
// stays mounted while the URL switches between trees; the open tree is the one the URL's slug names.
// `operatorEmail` is the operator's address from the server's environment, read at request time; unset, no feedback link.
export default function FamilyTree({ operatorEmail }: { operatorEmail?: string }) {
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
  // The developers' Evolution panel; it and the burger menu close each other.
  const [isEvolutionOpen, setIsEvolutionOpen] = useState(false);
  const [panel, setPanel] = useState<DashboardPanel | null>(null);
  const [familyCard, setFamilyCard] = useState<FamilyCardMode | null>(null);
  // A new object per "Add member" in the menu.
  const [addRequest, setAddRequest] = useState<object | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [cameraView, setCameraView] = useState<{ view: CameraView; nonce: number } | null>(null);
  const [focus, setFocus] = useState<Focus>(null);
  // The own card of a tree just planted: focused once the members are loaded, since the camera needs the card placed.
  const [plantedMemberId, setPlantedMemberId] = useState<string | null>(null);
  // A tree that was created but could not get its first person (the user), with what is needed to finish it.
  const [partialPlant, setPartialPlant] = useState<PartialPlant | null>(null);
  // Whether the task list after accepting an invitation is shown.
  const [showTasks, setShowTasks] = useState(false);
  const [welcomed, markWelcomed] = useWelcomed();
  // A new object per click, so clicking the same scroll again reopens the profile.
  const [profile, setProfile] = useState<Focus>(null);
  const [shownId, setShownId] = useState<string | null>(null);
  const [isEditingShown, setIsEditingShown] = useState(false);
  // The person last added through a "+" slot, whose toast offers to undo it; a new key per person restarts the toast.
  const [added, setAdded] = useState<{ member: Member; familyId: string; key: number } | null>(null);
  const hideAdded = useCallback(() => setAdded(null), []);
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

  if (plantedMemberId && members?.some((member) => member.id === plantedMemberId)) {
    setPlantedMemberId(null);
    setFocus({ id: plantedMemberId });
  }

  if (pending && pending.slug === urlSlug) setPending(null);
  const slug = pending ? pending.slug : urlSlug;
  const activeFamily = families ? familyOfSlug(families, slug) : null;
  const activeFamilyId = activeFamily?.id ?? null;
  // The signed-in user's own member in the open tree: marked with a badge, and the camera flies to it on opening.
  const selfId = activeFamily?.selfMemberId ?? null;
  const activeSlug = activeFamily?.slug;
  useEffect(() => {
    if (!activeSlug) return;
    try {
      localStorage.setItem(LAST_TREE_KEY, activeSlug);
    } catch {
      // Without storage `/` opens the default tree.
    }
  }, [activeSlug]);

  // Whatever belongs to the previous tree goes when another one opens, also by back/forward or a typed URL.
  const [openedFamilyId, setOpenedFamilyId] = useState(activeFamilyId);
  if (openedFamilyId !== activeFamilyId) {
    setOpenedFamilyId(activeFamilyId);
    forgetOpenFamily();
  }

  // The tree the camera already flew to the own card in; once per opened tree, and only when nothing else is focused.
  const [flownFamilyId, setFlownFamilyId] = useState<string | null>(null);
  if (activeFamilyId && selfId && !focus && flownFamilyId !== activeFamilyId && members?.some((member) => member.id === selfId)) {
    setFlownFamilyId(activeFamilyId);
    setFocus({ id: selfId });
  }
  if (flownFamilyId && flownFamilyId !== activeFamilyId) setFlownFamilyId(null);
  const tour = useTour();

  function forgetOpenFamily() {
    setMembers(null);
    setFocus(null);
    setProfile(null);
    setFamilyCard(null);
    setAddRequest(null);
    setFollowing(null);
    setIsSharing(false);
    setIsSearchOpen(false);
    setAdded(null);
    setShowTasks(false);
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
        router.replace(homePath(loaded, lastTree()) ?? '/');
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
    const home = homePath(families, lastTree());
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

  const closeEvolution = useCallback(() => setIsEvolutionOpen(false), []);

  function addMember() {
    stopFollowing();
    setIsMenuOpen(false);
    setPanel(null);
    setIsSearchOpen(false);
    setAddRequest({});
  }

  function addFamily(family: FamilySummary, card: FamilyCardMode | null = null) {
    setFamilies((current) => [...(current ?? []).filter((item) => item.id !== family.id), family]);
    openFamily(family, card);
  }

  // The welcome card planted a tree: open it, fly to the user's card, and start the tour.
  function planted(family: FamilySummary, memberId: string) {
    setPartialPlant(null);
    addFamily(family);
    setPlantedMemberId(memberId);
    tour.startTour();
  }

  // Planting stopped after the family was created: open it and offer to finish.
  function plantedPartly(partial: PartialPlant) {
    setPartialPlant(partial);
    addFamily(partial.family);
  }

  function acceptInvitation() {
    if (!activeFamily) return;
    markWelcomed(activeFamily.id);
    if (activeFamily.selfMemberId) {
      setFocus({ id: activeFamily.selfMemberId });
      setShowTasks(true);
    }
    tour.startTour();
  }

  // "Nicht ich": the card falls back to the unlinked text once the families are loaded again.
  async function notMe() {
    if (!activeFamily) return;
    const response = await clearSelfMember(activeFamily.id);
    if (response.status !== 204) throw new Error(`HTTP ${response.status}`);
    await loadFamilies(true);
  }

  function openOwnPerson(focusToo = false) {
    const id = activeFamily?.selfMemberId;
    if (!id) return;
    stopFollowing();
    if (focusToo) setFocus({ id });
    setProfile({ id });
  }

  // An unknown, invisible or reserved slug says so instead of showing an empty tree.
  const notFound = families !== null && slug !== undefined && !activeFamily;
  const emptyTree = emptyTreeOf(families, slug, activeFamily, members);
  const welcome = emptyTree === 'noTree' && canCreate;
  const invited = !notFound && !!activeFamily && !!members?.length && needsWelcome(activeFamily, welcomed);
  const canPlace = can(me, 'member.edit', activeFamily);
  const canShare = can(me, 'family.share', activeFamily);
  useTreeEvents(activeFamilyId, shownId, isEditingShown ? shownId : null);

  return (
    <OpenFamily family={activeFamily ?? null}>
      <Scene
        familyId={activeFamilyId}
        members={members ?? []}
        focus={focus}
        highlight={shownId}
        selfId={selfId}
        onOpen={(id) => {
          stopFollowing();
          // Editors get the "+" slots around the card, which are only usable up close.
          if (canPlace) setFocus({ id });
          setProfile({ id });
        }}
        evolutionOpen={isEvolutionOpen}
        onEvolutionClose={closeEvolution}
        onPlace={canPlace ? (id, placement) => void placeMember(id, placement) : undefined}
        // The members follow through the live events, like any other save.
        onAdded={
          canPlace && activeFamilyId
            ? (member) => setAdded((current) => ({ member, familyId: activeFamilyId, key: (current?.key ?? 0) + 1 }))
            : undefined
        }
        cameraView={cameraView}
      />
      <Header
        families={families}
        activeFamilyId={activeFamilyId}
        evolutionOpen={isEvolutionOpen}
        onEvolution={() => {
          setIsEvolutionOpen((open) => !open);
          setIsMenuOpen(false);
          setPanel(null);
        }}
        onFamilyClick={() => {
          if (activeFamilyId) return setFamilyCard((current) => current ?? 'view');
          if (!canCreate) return;
          setIsMenuOpen(true);
          setPanel('families');
        }}
        menu={
          <Dashboard
            isOpen={isMenuOpen}
            panel={panel}
            families={families}
            activeFamilyId={activeFamilyId}
            feedbackEmail={operatorEmail}
            onToggle={() => {
              setIsMenuOpen((open) => !open);
              setPanel(null);
              setIsEvolutionOpen(false);
            }}
            onPanel={(next) => setPanel((current) => (current === next ? null : next))}
          />
        }
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
      {added && <AddedToast key={added.key} added={added} onDone={hideAdded} />}
      {notFound && <TreeNotFound home={homePath(families)} />}
      {welcome && (
        <WelcomeCard
          families={families}
          onPlanted={planted}
          onPartial={plantedPartly}
          onImport={() => {
            setIsMenuOpen(true);
            setPanel('families');
          }}
        />
      )}
      {partialPlant && partialPlant.family.id === activeFamilyId && <PlantRetry partial={partialPlant} onPlanted={planted} />}
      {invited && activeFamily && members && (
        <InvitationCard family={activeFamily} members={members} onAccept={acceptInvitation} onNotMe={notMe} />
      )}
      {/* The task list waits for the intro tour, which points at the same places. */}
      {showTasks && !tour.active && activeFamily?.selfMemberId && (
        <InvitationTasks
          onCheck={() => openOwnPerson()}
          onPhoto={() => openOwnPerson()}
          onBranch={() => openOwnPerson(true)}
          onClose={() => setShowTasks(false)}
        />
      )}
      {emptyTree && !welcome && (
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
      {tour.active && activeFamily && members && !emptyTree && <IntroTour step={tour.step} onNext={tour.next} onSkip={tour.skip} />}
      {/* The welcome card has its own actions; the dock comes with the first tree. */}
      {!welcome && (
        <Dock
          canAdd={canPlace}
          canShare={canShare}
          hasFamily={!!activeFamily}
          hasSelection={!!shownId}
          onPerson={addMember}
          onSearch={() => setIsSearchOpen((open) => !open)}
          onInvite={() => {
            setIsMenuOpen(false);
            setPanel(null);
            setIsSearchOpen(false);
            setIsSharing(true);
          }}
          onView={(view) => setCameraView((current) => ({ view, nonce: (current?.nonce ?? 0) + 1 }))}
        />
      )}
      {isSharing && activeFamily && canShare && (
        <ShareDialog family={activeFamily} onClose={() => setIsSharing(false)} onChanged={() => void loadFamilies(true)} />
      )}
      <MemberSearch
        members={members ?? []}
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
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
