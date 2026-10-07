'use client';

import { useEffect, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import {
  createFamilyMember,
  deleteFamilyMember,
  getFamilyMembers,
  updateFamilyMember,
  type CreateMemberRequest,
  type Member,
} from '../lib/api/generated/members';
import RelativesDialog from './RelativesDialog';
import type { Focus } from './Scene';

type MemberForm = {
  firstName: string;
  lastName: string;
  birthDate: string;
  birthPlace: string;
  deathDate: string;
  deathPlace: string;
  note: string;
  photoUrl: string;
};

const EMPTY_FORM: MemberForm = {
  firstName: '',
  lastName: '',
  birthDate: '',
  birthPlace: '',
  deathDate: '',
  deathPlace: '',
  note: '',
  photoUrl: '',
};

export const DISCARD_PROMPT = 'Ungespeicherte Änderungen verwerfen?';

const toForm = (member: Member): MemberForm => ({
  firstName: member.firstName,
  lastName: member.lastName,
  birthDate: member.birthDate ?? '',
  birthPlace: member.birthPlace ?? '',
  deathDate: member.deathDate ?? '',
  deathPlace: member.deathPlace ?? '',
  note: member.note ?? '',
  photoUrl: member.photoUrl ?? '',
});

export function formatDate(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
}

function MemberDetails({
  member,
  members,
  onSelect,
  onEdit,
  onEditRelatives,
  onDelete,
}: {
  member: Member;
  members: Member[];
  onSelect: () => void;
  onEdit: () => void;
  onEditRelatives: () => void;
  onDelete: () => void;
}) {
  const birth = [formatDate(member.birthDate), member.birthPlace].filter(Boolean).join(' · ');
  const death = [formatDate(member.deathDate), member.deathPlace].filter(Boolean).join(' · ');
  const names = (list: Member[]) => list.map((m) => `${m.firstName} ${m.lastName}`).join(', ');
  const parents = names(members.filter((m) => member.parentIds.includes(m.id)));
  const children = names(members.filter((m) => m.parentIds.includes(member.id)));
  const partners = names(members.filter((m) => member.partnerIds.includes(m.id)));
  // Siblings have exactly the member's parents, half-siblings share only some or have others too.
  const shared = (m: Member) => m.parentIds.filter((id) => member.parentIds.includes(id)).length;
  const sameParents = (m: Member) => shared(m) === member.parentIds.length && m.parentIds.length === member.parentIds.length;
  const sharing = members.filter((m) => m.id !== member.id && shared(m) > 0);
  const siblings = names(sharing.filter(sameParents));
  const halfSiblings = names(sharing.filter((m) => !sameParents(m)));

  return (
    <li className="member-row">
      <div className="member-row-header">
        <h3>
          <button type="button" className="member-name" title="Im Baum anzeigen" onClick={onSelect}>
            {member.firstName} {member.lastName}
          </button>
        </h3>
        <button type="button" aria-label={`${member.firstName} ${member.lastName} löschen`} onClick={onDelete}>
          ×
        </button>
      </div>
      {birth && <p>Geboren: {birth}</p>}
      {death && <p>Verstorben: {death}</p>}
      {parents && <p>Eltern: {parents}</p>}
      {children && <p>Kinder: {children}</p>}
      {partners && <p>Partner: {partners}</p>}
      {siblings && <p>Geschwister: {siblings}</p>}
      {halfSiblings && <p>Halbgeschwister: {halfSiblings}</p>}
      {member.note && <p>{member.note}</p>}
      {member.photoUrl && (
        <p>
          <a href={member.photoUrl} target="_blank" rel="noreferrer">Foto ansehen</a>
        </p>
      )}
      <button type="button" className="member-relatives-button" onClick={onEdit}>
        Bearbeiten
      </button>
      <button type="button" className="member-relatives-button" onClick={onEditRelatives}>
        Beziehungen zuweisen
      </button>
    </li>
  );
}

export default function MembersControls({
  familyId,
  members,
  setMembers,
  profile,
  onSelect,
  onFamiliesChanged,
}: {
  familyId: string | null;
  members: Member[] | null;
  setMembers: Dispatch<SetStateAction<Member[] | null>>;
  // Member whose profile (the edit form) was requested from their scroll in the scene.
  profile: Focus;
  onSelect: (id: string) => void;
  onFamiliesChanged: () => void;
}) {
  const [isListOpen, setIsListOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<MemberForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<Member | null>(null);
  const [relativesOf, setRelativesOf] = useState<Member | null>(null);
  const listButtonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLElement>(null);

  async function reloadMembers() {
    if (!familyId) return;
    setIsLoading(true);
    setRequestError(null);
    try {
      const response = await getFamilyMembers(familyId);
      if (response.status !== 200 || !Array.isArray(response.data)) {
        throw new Error('Unexpected members response');
      }
      setMembers(response.data);
    } catch {
      setRequestError('Die Mitglieder konnten nicht geladen werden. Ist das BFF erreichbar?');
    } finally {
      setIsLoading(false);
    }
  }

  // A family switch clears the previous tree before loading the selected family's members.
  useEffect(() => {
    if (!familyId) return;
    const currentFamilyId = familyId;
    let current = true;
    async function loadFamilyMembers() {
      try {
        const response = await getFamilyMembers(currentFamilyId);
        if (!current) return;
        if (response.status !== 200 || !Array.isArray(response.data)) {
          throw new Error('Unexpected members response');
        }
        setMembers(response.data);
      } catch {
        if (current) {
          setRequestError('Die Mitglieder dieser Familie konnten nicht geladen werden. Ist das BFF erreichbar?');
        }
      } finally {
        if (current) setIsLoading(false);
      }
    }
    void loadFamilyMembers();
    return () => {
      current = false;
    };
  }, [familyId, setMembers]);

  useEffect(() => {
    const member = profile && members?.find((m) => m.id === profile.id);
    if (member) openForm(member);
    // Only a new profile request should open the form, not later member changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // The list is not modal: a press anywhere else or Escape closes it. While the relatives
  // dialog is open on top of it, that dialog handles both.
  useEffect(() => {
    if (!isListOpen || relativesOf) return;
    function closeOnOutsidePress(event: PointerEvent) {
      const target = event.target as Node;
      if (!listRef.current?.contains(target) && !listButtonRef.current?.contains(target)) setIsListOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsListOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isListOpen, relativesOf]);

  async function removeMember(member: Member) {
    if (!familyId) return;
    if (!window.confirm(`${member.firstName} ${member.lastName} wirklich löschen?`)) return;
    setRequestError(null);
    try {
      const response = await deleteFamilyMember(familyId, member.id);
      if (response.status !== 204 && response.status !== 404) throw new Error('Unexpected delete response');
      setMembers((current) => current?.filter((m) => m.id !== member.id) ?? null);
      onFamiliesChanged();
    } catch {
      setRequestError('Die Person konnte nicht gelöscht werden. Ist das BFF erreichbar?');
    }
  }

  function toggleMembers() {
    const willOpen = !isListOpen;
    setIsListOpen(willOpen);
    setIsFormOpen(false);
  }

  function openForm(member: Member | null = null) {
    if (!familyId) return;
    // Keep an unsaved create draft, but never carry an edited member's values into a new person.
    if (member) {
      setForm(toForm(member));
    } else if (editing) {
      setForm({ ...EMPTY_FORM });
    }
    setEditing(member);
    setIsListOpen(false);
    setFormError(null);
    setIsFormOpen(true);
  }

  // Outside click or Escape: the create draft is kept anyway, edits are only discarded on confirmation.
  function dismissForm() {
    if (isSaving) return;
    const initial = editing && toForm(editing);
    const changed = initial && (Object.keys(initial) as (keyof MemberForm)[]).some((key) => form[key] !== initial[key]);
    if (changed && !window.confirm(DISCARD_PROMPT)) return;
    setIsFormOpen(false);
  }

  function updateForm(field: keyof MemberForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!familyId) return;
    setIsSaving(true);
    setFormError(null);

    const request: CreateMemberRequest = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      birthDate: form.birthDate || null,
      birthPlace: form.birthPlace.trim() || null,
      deathDate: form.deathDate || null,
      deathPlace: form.deathPlace.trim() || null,
      note: form.note.trim() || null,
      photoUrl: form.photoUrl.trim() || null,
    };

    try {
      if (editing) {
        const response = await updateFamilyMember(familyId, editing.id, request);
        if (response.status !== 200) {
          setFormError(
            response.status === 404
              ? 'Die Person existiert nicht mehr.'
              : 'Die Person konnte nicht gespeichert werden. Bitte prüfe die Eingaben.',
          );
          return;
        }
        const updated = response.data;
        setMembers((current) => current?.map((m) => (m.id === updated.id ? updated : m)) ?? null);
        onFamiliesChanged();
        setIsFormOpen(false);
        onSelect(updated.id);
        return;
      }
      const response = await createFamilyMember(familyId, request);
      if (response.status !== 201) {
        setFormError('Die Person konnte nicht angelegt werden. Bitte prüfe die Eingaben.');
        return;
      }
      setMembers((current) => [response.data, ...(current ?? [])]);
      onFamiliesChanged();
      setIsFormOpen(false);
      onSelect(response.data.id);
      setForm({ ...EMPTY_FORM });
    } catch {
      setFormError('Das BFF ist noch nicht erreichbar oder der Endpunkt noch nicht implementiert.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="members-controls">
      <div className="members-toolbar" role="group" aria-label="Mitglieder">
        <button
          className="members-button members-button-primary"
          type="button"
          aria-expanded={isListOpen}
          aria-controls="members-panel"
          ref={listButtonRef}
          onClick={toggleMembers}
        >
          Personen
        </button>
        <button className="members-button" type="button" disabled={!familyId} onClick={() => openForm()}>
          Person hinzufügen
        </button>
      </div>

      {isListOpen && (
        <section className="members-panel" id="members-panel" aria-label="Personenliste" ref={listRef}>
          <header className="members-panel-header">
            <h2>Personen</h2>
            <button type="button" aria-label="Liste schließen" onClick={() => setIsListOpen(false)}>
              ×
            </button>
          </header>
          <div className="members-panel-body" aria-live="polite">
            {familyId && isLoading && <p className="members-loading">Mitglieder werden geladen …</p>}
            {requestError && !isLoading && (
              <div className="members-error" role="alert">
                <p>{requestError}</p>
                <button type="button" onClick={() => void reloadMembers()}>Erneut versuchen</button>
              </div>
            )}
            {!familyId && (
              <p className="members-empty">Wähle eine Familie aus oder generiere eine Zufallsfamilie.</p>
            )}
            {!isLoading && !requestError && familyId && members?.length === 0 && (
              <p className="members-empty">Noch keine Personen in dieser Familie angelegt.</p>
            )}
            {!isLoading && !requestError && members && members.length > 0 && (
              <ul className="member-list">
                {members.map((member) => (
                  <MemberDetails
                    key={member.id}
                    member={member}
                    members={members}
                    onEdit={() => openForm(member)}
                    onEditRelatives={() => setRelativesOf(member)}
                    onSelect={() => {
                      setIsListOpen(false);
                      onSelect(member.id);
                    }}
                    onDelete={() => void removeMember(member)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {isFormOpen && (
        <div
          className="member-dialog-backdrop"
          onPointerDown={(event) => event.target === event.currentTarget && dismissForm()}
          onKeyDown={(event) => event.key === 'Escape' && dismissForm()}
        >
          {/* tabIndex keeps focus (and so Escape) inside when clicking non-focusable parts. */}
          <section className="member-dialog" role="dialog" aria-modal="true" aria-labelledby="member-form-title" tabIndex={-1}>
            <header className="member-dialog-header">
              <h2 id="member-form-title">{editing ? 'Person bearbeiten' : 'Person hinzufügen'}</h2>
              <button
                className="member-dialog-close"
                type="button"
                aria-label="Formular schließen"
                onClick={() => setIsFormOpen(false)}
              >
                ×
              </button>
            </header>
            <form className="member-form" onSubmit={submitMember}>
              <label className="member-field">
                Vorname
                <input
                  autoFocus
                  autoComplete="given-name"
                  maxLength={100}
                  required
                  value={form.firstName}
                  onChange={(event) => updateForm('firstName', event.target.value)}
                />
              </label>
              <label className="member-field">
                Nachname
                <input
                  autoComplete="family-name"
                  maxLength={100}
                  required
                  value={form.lastName}
                  onChange={(event) => updateForm('lastName', event.target.value)}
                />
              </label>
              <label className="member-field">
                Geburtsdatum
                <input type="date" value={form.birthDate} onChange={(event) => updateForm('birthDate', event.target.value)} />
              </label>
              <label className="member-field">
                Geburtsort
                <input maxLength={200} value={form.birthPlace} onChange={(event) => updateForm('birthPlace', event.target.value)} />
              </label>
              <label className="member-field">
                Sterbedatum
                <input type="date" value={form.deathDate} onChange={(event) => updateForm('deathDate', event.target.value)} />
              </label>
              <label className="member-field">
                Sterbeort
                <input maxLength={200} value={form.deathPlace} onChange={(event) => updateForm('deathPlace', event.target.value)} />
              </label>
              <label className="member-field member-field-wide">
                Foto-URL
                <input type="url" maxLength={2048} value={form.photoUrl} onChange={(event) => updateForm('photoUrl', event.target.value)} />
              </label>
              <label className="member-field member-field-wide">
                Notiz
                <textarea maxLength={5000} value={form.note} onChange={(event) => updateForm('note', event.target.value)} />
              </label>
              {formError && <p className="member-form-error" role="alert">{formError}</p>}
              <div className="member-form-actions">
                <button type="button" disabled={isSaving} onClick={() => setIsFormOpen(false)}>
                  Abbrechen
                </button>
                <button type="submit" disabled={isSaving}>
                  {isSaving ? 'Wird gespeichert …' : 'Person speichern'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {relativesOf && members && familyId && (
        <RelativesDialog
          member={relativesOf}
          familyId={familyId}
          members={members}
          onClose={() => setRelativesOf(null)}
          onSaved={() => {
            setRelativesOf(null);
            void reloadMembers();
            onFamiliesChanged();
          }}
        />
      )}
    </div>
  );
}
