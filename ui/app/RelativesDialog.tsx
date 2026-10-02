'use client';

import { useState, type FormEvent } from 'react';
import { updateMemberRelatives, type Member } from '../lib/api/generated/members';

const fullName = (m: Member) => `${m.firstName} ${m.lastName}`;

function toggle(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

// Assigns any number of parents and children to one member.
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
  const [parentIds, setParentIds] = useState(member.parentIds);
  const [childIds, setChildIds] = useState(others.filter((m) => m.parentIds.includes(member.id)).map((m) => m.id));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const response = await updateMemberRelatives(member.id, { parentIds, childIds });
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
    <div className="member-dialog-backdrop">
      <section className="member-dialog" role="dialog" aria-modal="true" aria-labelledby="relatives-title">
        <header className="member-dialog-header">
          <h2 id="relatives-title">Beziehungen von {fullName(member)}</h2>
          <button className="member-dialog-close" type="button" aria-label="Dialog schließen" onClick={onClose}>
            ×
          </button>
        </header>
        <form className="member-form" onSubmit={save}>
          {list('Eltern', parentIds, childIds, (id) => setParentIds((ids) => toggle(ids, id)))}
          {list('Kinder', childIds, parentIds, (id) => setChildIds((ids) => toggle(ids, id)))}
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
