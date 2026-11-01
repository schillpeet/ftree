'use client';

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { createFamilyMember, deleteFamilyMember, updateFamilyMemberRelatives, type Member } from '../lib/api/generated/members';
import { useT } from './i18n';
import { nameOf } from './names';
import { problemCode } from './problems';
import { linkOf, nextSlot, prefilledLastName, type SlotKind } from './slots';
import './slots.css';

// How long the "is now growing" toast stays.
const TOAST_MS = 6_000;
// Air between the slot and the popover, and between the popover and the window edge.
const GAP = 12;
const EDGE = 16;

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
// Rendered into the body, so it keeps its size and stays above the scene's labels.
export default function QuickAdd({
  kind,
  member,
  familyId,
  anchor,
  onSaved,
  onClose,
}: {
  kind: SlotKind;
  // The selected person the new one is added to.
  member: Member;
  familyId: string;
  // The slot's box on screen when it was clicked.
  anchor: DOMRect;
  onSaved: (added: Member, next: SlotKind | null) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState(() => prefilledLastName(kind, member));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const name = nameOf(member, t.members.unknown);

  useLayoutEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const place = () => setPosition(placeBeside(anchor, form.offsetWidth, form.offsetHeight));
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor, error]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving || (!firstName.trim() && !lastName.trim())) return;
    setIsSaving(true);
    setError(null);
    try {
      const created = await createFamilyMember(familyId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
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
      {error && (
        <p className="quick-add-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="quick-add-save" disabled={isSaving || (!firstName.trim() && !lastName.trim())}>
        {isSaving ? t.saving : t.slots.add}
      </button>
      <span className="quick-add-hint">{nextSlot(kind) === 'father' ? t.slots.thenFather : t.slots.hint}</span>
    </form>,
    document.body,
  );
}

// Confirms a person added through a slot, with an undo that deletes exactly that person again.
export function AddedToast({ added, onDone }: { added: { member: Member; familyId: string }; onDone: () => void }) {
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
      <span>{failed ? t.slots.undoFailed : t.slots.added(nameOf(added.member, t.members.unknown))}</span>
      {failed ? (
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
