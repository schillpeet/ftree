'use client';

import { useState, type FormEvent } from 'react';
import { updateMemberRelatives, type Member } from '../lib/api/generated/members';
import { DISCARD_PROMPT } from './MembersControls';

const fullName = (m: Member) => `${m.firstName} ${m.lastName}`;

function toggle(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

// Assigns any number of parents, children, and partners to one member.
export default function RelativesDialog({
  member,
  members,
  onClose,
  onSaved,
}: {
  member: Member;
  members: Member[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const others = members.filter((m) => m.id !== member.id);
  const [initial] = useState(() => ({
    parentIds: member.parentIds,
    childIds: others.filter((m) => m.parentIds.includes(member.id)).map((m) => m.id),
    partnerIds: member.partnerIds,
  }));
  const [parentIds, setParentIds] = useState(initial.parentIds);
  const [childIds, setChildIds] = useState(initial.childIds);
  const [partnerIds, setPartnerIds] = useState(initial.partnerIds);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const response = await updateMemberRelatives(member.id, { parentIds, childIds, partnerIds });
      if (response.status === 400) {
        setError('Diese Zuordnung ist nicht möglich: Niemand kann sein eigener Vorfahre sein.');
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
      differs(parentIds, initial.parentIds) || differs(childIds, initial.childIds) || differs(partnerIds, initial.partnerIds);
    if (changed && !window.confirm(DISCARD_PROMPT)) return;
    onClose();
  }

  function list(legend: string, selected: string[], blocked: string[], onToggle: (id: string) => void) {
    return (
      <fieldset className="relatives-list">
        <legend>{legend}</legend>
        {others.length === 0 && <p>Noch keine anderen Personen angelegt.</p>}
        {others.map((m) => (
          <label key={m.id}>
            <input
              type="checkbox"
              checked={selected.includes(m.id)}
              disabled={blocked.includes(m.id)}
              onChange={() => onToggle(m.id)}
            />
            {fullName(m)}
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
          {list('Eltern', parentIds, [...childIds, ...partnerIds], (id) => setParentIds((ids) => toggle(ids, id)))}
          {list('Kinder', childIds, [...parentIds, ...partnerIds], (id) => setChildIds((ids) => toggle(ids, id)))}
          {list('Partner', partnerIds, [...parentIds, ...childIds], (id) => setPartnerIds((ids) => toggle(ids, id)))}
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
