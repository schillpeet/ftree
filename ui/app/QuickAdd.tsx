'use client';

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { createFamilyMember, deleteFamilyMember, updateFamilyMemberRelatives, type Member } from '../lib/api/generated/members';
import { useT } from './i18n';
import { displayName, initialsOf, nameOf } from './names';
import { lifeSpan } from './PersonPanel';
import { searchMembers } from './nameSearch';
import { problemCode } from './problems';
import { candidatesFor, linkExisting, linkOf, nextSlot, prefilledLastName, type SlotKind } from './slots';
import './slots.css';

// How long the "is now growing" toast stays.
const TOAST_MS = 6_000;
// Air between the slot and the popover, and between the popover and the window edge.
const GAP = 12;
const EDGE = 16;
// Existing people offered while typing, so nobody is added twice.
const SUGGESTIONS = 5;

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
  // `linked`: an existing person was linked, nobody was created.
  onSaved: (added: Member, next: SlotKind | null, linked?: boolean) => void;
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

  async function link(existing: Member) {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const linked = await updateFamilyMemberRelatives(familyId, existing.id, linkExisting(kind, existing, member.id, members));
      if (linked.status === 204) {
        onSaved(existing, nextSlot(kind), true);
        return;
      }
      const existingName = displayName(existing, members, t.placeholder.role);
      setError(
        linked.status === 403 ? t.slots.forbidden : linked.status === 409 ? t.slots.changed(existingName) : t.slots.linkFailed,
      );
    } catch {
      setError(t.members.unreachable);
    } finally {
      setIsSaving(false);
    }
  }

  // `nameless` adds a placeholder: someone not known or not entered yet.
  async function save(event: FormEvent<HTMLFormElement> | null, nameless = false) {
    event?.preventDefault();
    if (!nameless && chosen) return void link(chosen);
    if (isSaving || (!nameless && !firstName.trim() && !lastName.trim())) return;
    setIsSaving(true);
    setError(null);
    try {
      const created = await createFamilyMember(familyId, {
        firstName: nameless ? '' : firstName.trim(),
        lastName: nameless ? '' : lastName.trim(),
        birthName: null,
        birthDate: null,
        birthPlace: null,
        deathDate: null,
        deathPlace: null,
        note: null,
        photoUrl: null,
      });
      if (created.status !== 201) {
        setError(
          created.status === 403
            ? t.slots.forbidden
            : problemCode(created.data) === 'MEMBER_LIMIT_REACHED'
              ? t.memberLimit
              : t.members.createFailed,
        );
        return;
      }
      const added = created.data;
      let linkError: string | null = null;
      try {
        const linked = await updateFamilyMemberRelatives(familyId, added.id, linkOf(kind, member.id, added.version));
        if (linked.status !== 204) {
          linkError = linked.status === 403 ? t.slots.forbidden : linked.status === 409 ? t.slots.changed(name) : t.slots.linkFailed;
        }
      } catch {
        linkError = t.members.unreachable;
      }
      if (linkError) {
        // Never leave the new person unlinked: take them out again.
        const removed = await deleteFamilyMember(familyId, added.id).then(
          (response) => response.status === 204 || response.status === 404,
          () => false,
        );
        setError(removed ? linkError : t.slots.rollbackFailed(nameOf(added, t.members.unknown)));
        return;
      }
      onSaved(added, nextSlot(kind));
    } catch {
      setError(t.members.unreachable);
    } finally {
      setIsSaving(false);
    }
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
      <span className="quick-add-hint">{nextSlot(kind) === 'father' ? t.slots.thenFather : t.slots.hint}</span>
    </form>,
    document.body,
  );
}

// Confirms a person added through a slot, with an undo that deletes exactly that person again.
// A person linked from the suggestions gets a plain confirmation instead: nobody was created, so there is nothing to undo.
export function AddedToast({ added, onDone }: { added: { member: Member; familyId: string; linked?: boolean }; onDone: () => void }) {
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
      const response = await deleteFamilyMember(added.familyId, added.member.id);
      if (response.status !== 204 && response.status !== 404) throw new Error('Unexpected delete response');
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
