'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { updateFamilyMemberRelatives, type Member, type Sibling } from '../lib/api/generated/members';
import { DISCARD_PROMPT } from './MembersControls';

const fullName = (m: Member) => `${m.firstName} ${m.lastName}`;

function toggle(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

// Siblings are not stored but derived from the parents others share with the selected ones. Edits override
// the parents a member is taken to have (empty: no longer a sibling); the member's own relatives never count.
function siblingsOf(others: Member[], parentIds: string[], related: string[], edits: Record<string, string[]>): Sibling[] {
  return others
    .filter((m) => !related.includes(m.id))
    .map((m) => ({ id: m.id, parentIds: (edits[m.id] ?? m.parentIds).filter((id) => parentIds.includes(id)) }))
    .filter((s) => s.parentIds.length > 0);
}

const siblingKey = (s: Sibling) => `${s.id}:${[...s.parentIds].sort().join(',')}`;

// Assigns any number of parents, children, partners, and (half-)siblings to one member.
export default function RelativesDialog({
  member,
  familyId,
  members,
  onClose,
  onSaved,
}: {
  member: Member;
  familyId: string;
  members: Member[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const others = members.filter((m) => m.id !== member.id);
  const [initial] = useState(() => {
    const childIds = others.filter((m) => m.parentIds.includes(member.id)).map((m) => m.id);
    const related = [...member.parentIds, ...childIds, ...member.partnerIds];
    return {
      parentIds: member.parentIds,
      childIds,
      partnerIds: member.partnerIds,
      siblings: siblingsOf(others, member.parentIds, related, {}),
    };
  });
  const [parentIds, setParentIds] = useState(initial.parentIds);
  const [childIds, setChildIds] = useState(initial.childIds);
  const [partnerIds, setPartnerIds] = useState(initial.partnerIds);
  const [siblingEdits, setSiblingEdits] = useState<Record<string, string[]>>({});
  const siblings = siblingsOf(others, parentIds, [...parentIds, ...childIds, ...partnerIds], siblingEdits);
  const siblingIds = siblings.map((s) => s.id);
  // Siblings keep parents beyond the member's, so only those ending up with exactly the member's parents are full siblings.
  const withOtherParents = others.filter((m) => m.parentIds.some((id) => !parentIds.includes(id))).map((m) => m.id);
  const isFull = (s: Sibling) => s.parentIds.length === parentIds.length && !withOtherParents.includes(s.id);
  const fullIds = siblings.filter(isFull).map((s) => s.id);
  const halfIds = siblings.filter((s) => !isFull(s)).map((s) => s.id);
  const setShared = (id: string, ids: string[]) => setSiblingEdits((edits) => ({ ...edits, [id]: ids }));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const response = await updateFamilyMemberRelatives(familyId, member.id, { parentIds, childIds, partnerIds, siblings });
      if (response.status === 400) {
        setError('Diese Zuordnung ist nicht möglich. Niemand kann sein eigener Vorfahre sein.');
        return;
      }
      if (response.status !== 204) throw new Error('Unexpected relatives response');
      onSaved();
    } catch {
      setError('Die Beziehungen konnten nicht gespeichert werden. Ist das BFF erreichbar?');
    } finally {
      setIsSaving(false);
    }
  }

  // Outside click or Escape: unsaved changes are only discarded on confirmation.
  function dismiss() {
    if (isSaving) return;
    const differs = (ids: string[], before: string[]) => ids.length !== before.length || ids.some((id) => !before.includes(id));
    const changed =
      differs(parentIds, initial.parentIds) ||
      differs(childIds, initial.childIds) ||
      differs(partnerIds, initial.partnerIds) ||
      differs(siblings.map(siblingKey), initial.siblings.map(siblingKey));
    if (changed && !window.confirm(DISCARD_PROMPT)) return;
    onClose();
  }

  // extra renders next to an entry, e.g. the shared parent of a half-sibling.
  function list(
    legend: string,
    selected: string[],
    blocked: string[],
    onToggle: (id: string) => void,
    { hint, disabled, extra }: { hint?: string | false; disabled?: boolean; extra?: (m: Member) => ReactNode } = {},
  ) {
    return (
      <fieldset className="relatives-list" disabled={disabled}>
        <legend>{legend}</legend>
        {others.length === 0 && <p>Noch keine anderen Personen angelegt.</p>}
        {others.length > 0 && hint && <p>{hint}</p>}
        {others.map((m) => (
          <label key={m.id}>
            <input
              type="checkbox"
              checked={selected.includes(m.id)}
              disabled={blocked.includes(m.id)}
              onChange={() => onToggle(m.id)}
            />
            {fullName(m)}
            {extra?.(m)}
          </label>
        ))}
      </fieldset>
    );
  }

  return (
    <div
      className="member-dialog-backdrop"
      onPointerDown={(event) => event.target === event.currentTarget && dismiss()}
      onKeyDown={(event) => event.key === 'Escape' && dismiss()}
    >
      {/* tabIndex keeps focus (and so Escape) inside when clicking non-focusable parts. */}
      <section className="member-dialog" role="dialog" aria-modal="true" aria-labelledby="relatives-title" tabIndex={-1}>
        <header className="member-dialog-header">
          <h2 id="relatives-title">Beziehungen von {fullName(member)}</h2>
          {/* Focused on open, so Escape reaches the backdrop's handler. */}
          <button className="member-dialog-close" type="button" aria-label="Dialog schließen" autoFocus onClick={onClose}>
            ×
          </button>
        </header>
        <form className="member-form" onSubmit={save}>
          {list('Eltern', parentIds, [...childIds, ...partnerIds, ...siblingIds], (id) => setParentIds((ids) => toggle(ids, id)))}
          {list('Kinder', childIds, [...parentIds, ...partnerIds, ...siblingIds], (id) => setChildIds((ids) => toggle(ids, id)))}
          {list('Partner', partnerIds, [...parentIds, ...childIds, ...siblingIds], (id) => setPartnerIds((ids) => toggle(ids, id)))}
          {list(
            'Geschwister',
            fullIds,
            [...parentIds, ...childIds, ...partnerIds, ...withOtherParents],
            (id) => setShared(id, fullIds.includes(id) ? [] : parentIds),
            { hint: parentIds.length === 0 && 'Erst Eltern zuweisen', disabled: parentIds.length === 0 },
          )}
          {/* Existing half-siblings can always be removed; adding one needs a second parent to leave out. */}
          {list(
            'Halbgeschwister',
            halfIds,
            [
              ...parentIds,
              ...childIds,
              ...partnerIds,
              ...(parentIds.length < 2 ? others.filter((m) => !halfIds.includes(m.id)).map((m) => m.id) : []),
            ],
            (id) => setShared(id, halfIds.includes(id) ? [] : [parentIds[0]]),
            {
              hint: parentIds.length === 0 ? 'Erst Eltern zuweisen' : parentIds.length === 1 && 'Erst zwei Eltern zuweisen',
              disabled: parentIds.length === 0,
              extra: (m) =>
                parentIds.length >= 2 &&
                halfIds.includes(m.id) && (
                  <select
                    aria-label={`Gemeinsamer Elternteil mit ${fullName(m)}`}
                    value={siblings.find((s) => s.id === m.id)?.parentIds[0]}
                    onChange={(event) => setShared(m.id, [event.target.value])}
                  >
                    {parentIds.map((id) => (
                      <option key={id} value={id}>
                        über {fullName(others.find((p) => p.id === id)!)}
                      </option>
                    ))}
                  </select>
                ),
            },
          )}
          {error && <p className="member-form-error" role="alert">{error}</p>}
          <div className="member-form-actions">
            <button type="button" disabled={isSaving} onClick={onClose}>
              Abbrechen
            </button>
            <button type="submit" disabled={isSaving}>
              {isSaving ? 'Wird gespeichert …' : 'Beziehungen speichern'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
