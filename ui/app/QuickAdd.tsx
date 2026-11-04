'use client';

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { createFamilyMember, deleteFamilyMember, updateFamilyMemberRelatives, type Member, type Relatives } from '../lib/api/generated/members';
import { useT } from './i18n';
import { displayName, initialsOf, lifeSpan, nameOf } from './names';
import { searchMembers } from './nameSearch';
import { problemCode } from './problems';
import { candidatesFor, linkExisting, linkOf, nextSlot, prefilledLastName, withParents, type SlotKind } from './slots';
import './slots.css';

// How long the "is now growing" toast stays.
const TOAST_MS = 6_000;
// Air between the slot and the popover, and between the popover and the window edge.
const GAP = 12;
const EDGE = 16;
// Existing people offered while typing, so nobody is added twice.
const SUGGESTIONS = 5;

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

// The quick-add popover of a "+" slot: first and last name, Enter saves, Escape closes. Saving creates the person and
// then links them to `member`; when the link fails, the new person is deleted again, so nobody is left half-linked.
// While typing, it suggests people already in the tree who fit the slot (`candidatesFor`); choosing one links them
// instead of creating anyone.
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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState(() => prefilledLastName(kind, member));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const name = displayName(member, members, t.placeholder.role);
  const query = `${firstName} ${lastName}`.trim();
  const suggestions = firstName.trim() ? searchMembers(candidatesFor(kind, member, members), query, SUGGESTIONS) : [];
  const [active, setActive] = useState(-1);
  const chosen = suggestions[active] as Member | undefined;

  useLayoutEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const place = () => setPosition(placeBeside(anchor, form.offsetWidth, form.offsetHeight));
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor, error]);

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

  // An existing person from the suggestions: linked to `member`, nobody new unless a placeholder parent is needed.
  function link(existing: Member) {
    return run(async (created) => {
      if (kind === 'sibling' && member.parentIds.length === 0 && existing.parentIds.length > 0) {
        // The person joins the sibling's parents.
        await relink(member, withParents(member, existing.parentIds, members));
      } else {
        const parentIds = kind === 'sibling' ? await sharedParents(created) : [];
        await relink(existing, linkExisting(kind, existing, member.id, members, parentIds));
      }
      onSaved(existing, nextSlot(kind), { linked: true, alsoAdded: created });
    });
  }

  // `nameless` adds a placeholder: someone not known or not entered yet.
  function save(event: FormEvent<HTMLFormElement> | null, nameless = false) {
    event?.preventDefault();
    if (!nameless && chosen) return void link(chosen);
    if (!nameless && !firstName.trim() && !lastName.trim()) return;
    return void run(async (created) => {
      const parentIds = kind === 'sibling' ? await sharedParents(created) : [];
      const added = await createPerson(nameless ? '' : firstName.trim(), nameless ? '' : lastName.trim());
      created.push(added);
      await relink(added, linkOf(kind, member.id, added.version, parentIds));
      onSaved(added, nextSlot(kind), { alsoAdded: created.filter((person) => person.id !== added.id) });
    });
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
        if (suggestions.length > 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault();
          const step = event.key === 'ArrowDown' ? 1 : -1;
          // -1 is "none": Enter then adds a new person.
          setActive((current) => ((current + 1 + step + suggestions.length + 1) % (suggestions.length + 1)) - 1);
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
      <input
        className="quick-add-field"
        aria-label={t.members.firstName}
        placeholder={t.members.firstName}
        value={firstName}
        onChange={(event) => {
          setFirstName(event.target.value);
          setActive(-1);
        }}
        maxLength={100}
        autoComplete="off"
        autoFocus
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-controls="quick-add-suggestions"
        aria-activedescendant={chosen ? `quick-add-${chosen.id}` : undefined}
      />
      {suggestions.length > 0 && (
        <ul className="quick-add-suggestions" id="quick-add-suggestions" role="listbox" aria-label={t.slots.existing}>
          {suggestions.map((m, i) => (
            <li key={m.id} id={`quick-add-${m.id}`} role="option" aria-selected={i === active}>
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
        </ul>
      )}
      <input
        className="quick-add-field"
        aria-label={t.members.lastName}
        placeholder={t.members.lastName}
        value={lastName}
        onChange={(event) => {
          setLastName(event.target.value);
          setActive(-1);
        }}
        maxLength={100}
        autoComplete="off"
      />
      {error && (
        <p className="quick-add-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="quick-add-save" disabled={isSaving || (!firstName.trim() && !lastName.trim())}>
        {isSaving ? t.saving : suggestions.length > 0 ? t.slots.addNew : t.slots.add}
      </button>
      <button type="button" className="quick-add-unknown" title={t.slots.notKnownHint} onClick={() => void save(null, true)} disabled={isSaving}>
        {t.slots.notKnown}
      </button>
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
