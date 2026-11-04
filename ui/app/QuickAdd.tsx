'use client';

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  createFamilyMember,
  deleteFamilyMember,
  updateFamilyMemberRelatives,
  type Member,
  type ParentLink,
  type Relatives,
} from '../lib/api/generated/members';
import { useT } from './i18n';
import { displayName, initialsOf, lifeSpan, nameOf } from './names';
import { searchMembers } from './nameSearch';
import { problemCode } from './problems';
import {
  asksParentKind,
  coParentCandidates,
  linkExisting,
  linkOf,
  nextSlot,
  prefilledLastName,
  slotOffer,
  withParentOfKind,
  withParents,
  type SlotKind,
} from './slots';
import './slots.css';

// How long the "is now growing" toast stays.
const TOAST_MS = 6_000;
// Air between the slot and the popover, and between the popover and the window edge.
const GAP = 12;
const EDGE = 16;
// Existing people offered right away and while typing, so nobody is added twice.
const SUGGESTIONS = 6;
const PARENT_KINDS: ParentLink['kind'][] = ['biological', 'adoptive', 'step', 'foster'];

export type AddedExtra = { linked?: boolean; alsoAdded?: Member[] };

// A step of saving that failed, with the message to show.
class Failure extends Error {}

// Where the popover opens: beside the slot that opened it, kept inside the window.
function placeBeside(anchor: DOMRect, width: number, height: number) {
  const right = anchor.right + GAP;
  const left = right + width <= window.innerWidth - EDGE ? right : anchor.left - GAP - width;
  return {
    left: Math.min(Math.max(left, EDGE), window.innerWidth - EDGE - width),
    top: Math.min(Math.max(anchor.top - GAP, EDGE), window.innerHeight - EDGE - height),
  };
}

// The quick-add popover of a "+" slot searches the tree first (`slotOffer`): it opens with who already has that place,
// shown so nobody is entered twice, and who the tree points to; typing searches everyone who fits the slot. Choosing
// someone links them instead of creating anyone; for a partner's child or a parent's partner it first asks what kind of
// parent (`asksParentKind`).
// "+ Neue Person anlegen" at the end of the list turns it into first and last name, prefilled from the search; saving
// creates the person and then links them to `member`; when the link fails, the new person is deleted again, so nobody is
// left half-linked. Escape closes.
// Rendered into the body, so it keeps its size and stays above the scene's labels.
export default function QuickAdd({
  kind,
  member,
  members,
  familyId,
  anchor,
  onSaved,
  onClose,
}: {
  kind: SlotKind;
  // The selected person the new one is added to.
  member: Member;
  // The family's members, for suggestions and for naming placeholders.
  members: Member[];
  familyId: string;
  // The slot's box on screen when it was clicked.
  anchor: DOMRect;
  // `linked`: an existing person was linked rather than created; `alsoAdded`: placeholder parents made on the way.
  onSaved: (added: Member, next: SlotKind | null, extra: AddedExtra) => void;
  onClose: () => void;
}) {
  const t = useT();
  const offer = slotOffer(kind, member, members);
  const canSearch = offer.linked.length + offer.suggested.length + offer.others.length > 0;
  // Searching the tree, or entering a new person; with nobody in the tree to show there is nothing to search.
  const [isNew, setIsNew] = useState(!canSearch);
  const [search, setSearch] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState(() => prefilledLastName(kind, member));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // The field to type into after switching between searching and entering a new person.
  const fieldRef = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const name = displayName(member, members, t.placeholder.role);
  const query = search.trim();
  // Already in that place: shown, not offered. Ties in a search keep the suggested ones first.
  const already = isNew ? [] : query ? searchMembers(offer.linked, query, SUGGESTIONS) : offer.linked;
  const suggestions = isNew
    ? []
    : query
      ? searchMembers([...offer.suggested, ...offer.others], query, SUGGESTIONS)
      : offer.suggested.slice(0, SUGGESTIONS);
  // The highlighted entry: a suggestion, `suggestions.length` for "+ Neue Person anlegen", or -1 for none.
  const [active, setActive] = useState(-1);
  const chosen = suggestions[active] as Member | undefined;
  // A partner's child or a parent's partner waits here for the kind of parent before being linked.
  const [kindFor, setKindFor] = useState<Member | null>(null);
  // After a partner: is the partner also a parent of the person's children? Asked child by child, and only for children
  // with fewer than two parents; `done` is what the popover reports once the questions are through.
  const [asking, setAsking] = useState<{ partner: Member; children: Member[]; done: () => void } | null>(null);

  useLayoutEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const place = () => setPosition(placeBeside(anchor, form.offsetWidth, form.offsetHeight));
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor, error, isNew, suggestions.length]);

  useEffect(() => fieldRef.current?.focus(), [isNew]);

  async function createPerson(first: string, last: string) {
    const created = await createFamilyMember(familyId, {
      firstName: first,
      lastName: last,
      birthName: null,
      birthDate: null,
      birthPlace: null,
      deathDate: null,
      deathPlace: null,
      note: null,
      photoUrl: null,
    });
    if (created.status === 201) return created.data;
    throw new Failure(
      created.status === 403
        ? t.slots.forbidden
        : problemCode(created.data) === 'MEMBER_LIMIT_REACHED'
          ? t.memberLimit
          : t.members.createFailed,
    );
  }

  async function relink(person: Member, relatives: Relatives) {
    const linked = await updateFamilyMemberRelatives(familyId, person.id, relatives);
    if (linked.status === 204) return;
    const who = displayName(person, members, t.placeholder.role);
    throw new Failure(linked.status === 403 ? t.slots.forbidden : linked.status === 409 ? t.slots.changed(who) : t.slots.linkFailed);
  }

  // Siblings share parents: a person without any gets a placeholder parent first, which is returned to be undone with
  // the rest. `created` collects everyone made on the way, so a failure can take them out again.
  async function sharedParents(created: Member[]): Promise<string[]> {
    if (member.parentIds.length > 0) return member.parentIds;
    const placeholder = await createPerson('', '');
    created.push(placeholder);
    await relink(member, withParents(member, [placeholder.id], members));
    return [placeholder.id];
  }

  // Runs `steps`; when one fails, everyone created so far is deleted again, so nobody is left half-linked.
  async function run(steps: (created: Member[]) => Promise<void>) {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    const created: Member[] = [];
    try {
      await steps(created);
    } catch (failure) {
      const message = failure instanceof Failure ? failure.message : t.members.unreachable;
      const results = await Promise.all(
        created.map((person) =>
          deleteFamilyMember(familyId, person.id).then(
            (response) => response.status === 204 || response.status === 404,
            () => false,
          ),
        ),
      );
      const left = created.find((_, i) => !results[i]);
      setError(left ? t.slots.rollbackFailed(displayName(left, members, t.placeholder.role)) : message);
    } finally {
      setIsSaving(false);
    }
  }

  // Ends a save: for a partner, first asks about the person's children who could share them as a parent.
  function finish(person: Member, done: () => void) {
    const children = kind === 'partner' ? coParentCandidates(member, person, members) : [];
    if (children.length > 0) setAsking({ partner: person, children, done });
    else done();
  }

  // "Ja": the partner becomes a parent of the child in question too.
  function answer(yes: boolean) {
    if (!asking) return;
    const [child, ...rest] = asking.children;
    const next = () => (rest.length > 0 ? setAsking({ ...asking, children: rest }) : asking.done());
    if (!yes) return next();
    void run(async () => {
      await relink(child, withParents(child, [...child.parentIds, asking.partner.id], members));
      next();
    });
  }

  // An existing person from the suggestions: linked to `member`, nobody new unless a placeholder parent is needed.
  // A partner's child or a parent's partner first asks what kind of parent (`kindFor`).
  function link(existing: Member) {
    if (asksParentKind(kind, member, existing)) {
      setError(null);
      return setKindFor(existing);
    }
    return run(async (created) => {
      if (kind === 'sibling' && member.parentIds.length === 0 && existing.parentIds.length > 0) {
        // The person joins the sibling's parents.
        await relink(member, withParents(member, existing.parentIds, members));
      } else {
        const parentIds = kind === 'sibling' ? await sharedParents(created) : [];
        await relink(existing, linkExisting(kind, existing, member.id, members, parentIds));
      }
      finish(existing, () => onSaved(existing, nextSlot(kind), { linked: true, alsoAdded: created }));
    });
  }

  // `kindFor` becomes the child (for "+ Kind") or the parent (for a parent slot) of `member`, as a parent of `parentKind`.
  function linkAsParent(existing: Member, parentKind: ParentLink['kind']) {
    return run(async () => {
      if (kind === 'child') await relink(existing, withParentOfKind(existing, member.id, parentKind, members));
      else await relink(member, withParentOfKind(member, existing.id, parentKind, members));
      onSaved(existing, nextSlot(kind), { linked: true });
    });
  }

  // From the search to the name fields: the last word typed becomes the surname, unless only one was typed, which then
  // is the first name beside the prefilled surname.
  function enterNew() {
    const words = query.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      setFirstName(words.slice(0, -1).join(' '));
      setLastName(words[words.length - 1]);
    } else {
      setFirstName(words[0] ?? '');
    }
    setError(null);
    setIsNew(true);
  }

  // `nameless` adds a placeholder: someone not known or not entered yet.
  function save(event: FormEvent<HTMLFormElement> | null, nameless = false) {
    event?.preventDefault();
    if (!nameless && !isNew) {
      if (chosen) return void link(chosen);
      // Enter without a highlighted person goes on to a new one, once something is typed.
      if (active === suggestions.length || query) enterNew();
      return;
    }
    if (!nameless && !firstName.trim() && !lastName.trim()) return;
    return void run(async (created) => {
      const parentIds = kind === 'sibling' ? await sharedParents(created) : [];
      const added = await createPerson(nameless ? '' : firstName.trim(), nameless ? '' : lastName.trim());
      created.push(added);
      await relink(added, linkOf(kind, member.id, added.version, parentIds));
      finish(added, () => onSaved(added, nextSlot(kind), { alsoAdded: created.filter((person) => person.id !== added.id) }));
    });
  }

  if (kindFor) {
    const [parent, child] = kind === 'child' ? [member, kindFor] : [kindFor, member];
    return createPortal(
      <form
        ref={formRef}
        className="glass quick-add"
        data-keeps-panel
        style={position ?? { left: anchor.right + GAP, top: anchor.top }}
        aria-label={t.slots.kindTitle}
        onSubmit={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.stopPropagation();
          // Escape goes back to the search; nothing is linked yet.
          if (!isSaving) setKindFor(null);
        }}
      >
        <div className="quick-add-head">
          <h2>{t.slots.kindTitle}</h2>
        </div>
        <p className="quick-add-question">
          {t.slots.kindQuestion(displayName(parent, members, t.placeholder.role), displayName(child, members, t.placeholder.role))}
        </p>
        {error && (
          <p className="quick-add-error" role="alert">
            {error}
          </p>
        )}
        <div className="quick-add-kinds">
          {PARENT_KINDS.map((parentKind, i) => (
            <button
              key={parentKind}
              type="button"
              className="quick-add-kind"
              disabled={isSaving}
              autoFocus={i === 0}
              onClick={() => void linkAsParent(kindFor, parentKind)}
            >
              {t.relatives.parentKinds[parentKind]}
            </button>
          ))}
        </div>
        <button type="button" className="quick-add-unknown" disabled={isSaving} onClick={() => setKindFor(null)}>
          {t.slots.backToSearch}
        </button>
      </form>,
      document.body,
    );
  }

  if (asking) {
    const child = asking.children[0];
    const partnerName = displayName(asking.partner, members, t.placeholder.role);
    return createPortal(
      <form
        ref={formRef}
        className="glass quick-add"
        data-keeps-panel
        style={position ?? { left: anchor.right + GAP, top: anchor.top }}
        aria-label={t.slots.alsoParentTitle}
        onSubmit={(event) => {
          event.preventDefault();
          answer(true);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.stopPropagation();
          // Escape skips the remaining questions; the partner stays.
          if (!isSaving) asking.done();
        }}
      >
        <div className="quick-add-head">
          <h2>{t.slots.alsoParentTitle}</h2>
        </div>
        <p className="quick-add-question">
          {t.slots.alsoParent(partnerName, displayName(child, members, t.placeholder.role))}
        </p>
        {error && (
          <p className="quick-add-error" role="alert">
            {error}
          </p>
        )}
        <div className="quick-add-answers">
          <button type="submit" className="quick-add-save" disabled={isSaving} autoFocus>
            {t.slots.yes}
          </button>
          <button type="button" className="quick-add-no" disabled={isSaving} onClick={() => answer(false)}>
            {t.slots.no}
          </button>
        </div>
        {asking.children.length > 1 && <span className="quick-add-hint">{t.slots.moreChildren(asking.children.length - 1)}</span>}
      </form>,
      document.body,
    );
  }

  return createPortal(
    <form
      ref={formRef}
      className="glass quick-add"
      data-keeps-panel
      // Placed before the first paint; never hidden, so the first name can take the focus.
      style={position ?? { left: anchor.right + GAP, top: anchor.top }}
      aria-label={t.slots.title[kind](name)}
      onSubmit={(event) => void save(event)}
      onKeyDown={(event) => {
        if (!isNew && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault();
          const step = event.key === 'ArrowDown' ? 1 : -1;
          // The suggestions, "+ Neue Person anlegen", and -1 for none, in a ring.
          const count = suggestions.length + 2;
          setActive((current) => ((current + 1 + step + count) % count) - 1);
          return;
        }
        if (event.key !== 'Escape') return;
        // Only the popover closes, not the panel behind it.
        event.stopPropagation();
        if (!isSaving) onClose();
      }}
    >
      <div className="quick-add-head">
        <h2>{t.slots.title[kind](name)}</h2>
        <button type="button" className="quick-add-close" aria-label={t.slots.close} onClick={onClose} disabled={isSaving}>
          <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>
      </div>
      {isNew ? (
        <>
          <input
            className="quick-add-field"
            aria-label={t.members.firstName}
            placeholder={t.members.firstName}
            ref={fieldRef}
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            maxLength={100}
            autoComplete="off"
            autoFocus
          />
          <input
            className="quick-add-field"
            aria-label={t.members.lastName}
            placeholder={t.members.lastName}
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            maxLength={100}
            autoComplete="off"
          />
        </>
      ) : (
        <>
          <input
            className="quick-add-field quick-add-search"
            type="search"
            aria-label={t.slots.search}
            placeholder={t.slots.search}
            ref={fieldRef}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setActive(-1);
            }}
            maxLength={200}
            autoComplete="off"
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls="quick-add-suggestions"
            aria-activedescendant={active >= 0 ? `quick-add-option-${active}` : undefined}
          />
          <ul className="quick-add-suggestions" id="quick-add-suggestions" role="listbox" aria-label={t.slots.existing}>
            {already.length > 0 && (
              <>
                <li className="quick-add-suggestions-label" role="presentation">
                  {t.slots.already}
                </li>
                {already.map((m) => (
                  <li key={m.id} className="quick-add-already" role="presentation">
                    <span className="quick-add-suggestion-avatar" aria-hidden="true">
                      {initialsOf(m)}
                    </span>
                    <span className="quick-add-suggestion-name">{displayName(m, members, t.placeholder.role)}</span>
                    <span className="quick-add-suggestion-years">{lifeSpan(m)}</span>
                    <span className="quick-add-already-mark" aria-hidden="true">
                      ✓
                    </span>
                  </li>
                ))}
              </>
            )}
            {suggestions.length > 0 ? (
              <li className="quick-add-suggestions-label" role="presentation">
                {query ? t.slots.existing : t.slots.suggested}
              </li>
            ) : (
              <li className="quick-add-suggestions-empty" role="presentation">
                {query || offer.others.length === 0 ? t.slots.noMatch : t.slots.typeToSearch}
              </li>
            )}
            {suggestions.map((m, i) => (
              <li key={m.id} id={`quick-add-option-${i}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  className={i === active ? 'is-active' : undefined}
                  tabIndex={-1}
                  disabled={isSaving}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => void link(m)}
                >
                  <span className="quick-add-suggestion-avatar" aria-hidden="true">
                    {initialsOf(m)}
                  </span>
                  <span className="quick-add-suggestion-name">{displayName(m, members, t.placeholder.role)}</span>
                  <span className="quick-add-suggestion-years">{lifeSpan(m)}</span>
                  {i === active && <span className="quick-add-suggestion-link">{t.slots.link}</span>}
                </button>
              </li>
            ))}
            <li
              id={`quick-add-option-${suggestions.length}`}
              className="quick-add-new"
              role="option"
              aria-selected={active === suggestions.length}
            >
              <button
                type="button"
                className={active === suggestions.length ? 'is-active' : undefined}
                tabIndex={-1}
                disabled={isSaving}
                onMouseEnter={() => setActive(suggestions.length)}
                onClick={enterNew}
              >
                {query ? t.slots.newNamed(query) : t.slots.newPerson}
              </button>
            </li>
          </ul>
        </>
      )}
      {error && (
        <p className="quick-add-error" role="alert">
          {error}
        </p>
      )}
      {isNew && (
        <button type="submit" className="quick-add-save" disabled={isSaving || (!firstName.trim() && !lastName.trim())}>
          {isSaving ? t.saving : t.slots.add}
        </button>
      )}
      <div className="quick-add-more">
        {isNew && canSearch && (
          <button type="button" className="quick-add-unknown" onClick={() => setIsNew(false)} disabled={isSaving}>
            {t.slots.backToSearch}
          </button>
        )}
        <button type="button" className="quick-add-unknown" title={t.slots.notKnownHint} onClick={() => void save(null, true)} disabled={isSaving}>
          {t.slots.notKnown}
        </button>
      </div>
      <span className="quick-add-hint">
        {nextSlot(kind) === 'father'
          ? t.slots.thenFather
          : kind === 'sibling' && member.parentIds.length === 0
            ? t.slots.siblingHint
            : t.slots.hint}
      </span>
    </form>,
    document.body,
  );
}

// Confirms a person added through a slot, with an undo that deletes exactly that person again.
// A person linked from the suggestions gets a plain confirmation instead: nobody was created, so there is nothing to undo.
// The undo also deletes placeholder parents made on the way.
export function AddedToast({ added, onDone }: { added: { member: Member; familyId: string } & AddedExtra; onDone: () => void }) {
  const t = useT();
  const [isUndoing, setIsUndoing] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isUndoing || failed) return;
    const timer = setTimeout(onDone, TOAST_MS);
    return () => clearTimeout(timer);
  }, [isUndoing, failed, onDone]);

  async function undo() {
    setIsUndoing(true);
    try {
      for (const person of [added.member, ...(added.alsoAdded ?? [])]) {
        const response = await deleteFamilyMember(added.familyId, person.id);
        if (response.status !== 204 && response.status !== 404) throw new Error('Unexpected delete response');
      }
      onDone();
    } catch {
      setFailed(true);
    } finally {
      setIsUndoing(false);
    }
  }

  return (
    <div className="glass added-toast" role="status" data-keeps-panel>
      <span>
        {failed
          ? t.slots.undoFailed
          : added.linked
            ? t.slots.linked(nameOf(added.member, t.members.unknown))
            : t.slots.added(nameOf(added.member, t.members.unknown))}
      </span>
      {added.linked ? (
        <button type="button" onClick={onDone}>
          {t.slots.close}
        </button>
      ) : failed ? (
        <button type="button" onClick={onDone}>
          {t.slots.close}
        </button>
      ) : (
        <button type="button" onClick={() => void undo()} disabled={isUndoing}>
          {t.slots.undo}
        </button>
      )}
    </div>
  );
}
