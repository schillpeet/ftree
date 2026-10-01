'use client';

import { useState, type FormEvent } from 'react';
import {
  createMember,
  getMembers,
  type CreateMemberRequest,
  type Member,
} from '../lib/api/generated/members';

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

function formatDate(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
}

function MemberDetails({ member }: { member: Member }) {
  const birth = [formatDate(member.birthDate), member.birthPlace].filter(Boolean).join(' · ');
  const death = [formatDate(member.deathDate), member.deathPlace].filter(Boolean).join(' · ');

  return (
    <li className="member-row">
      <h3>{member.firstName} {member.lastName}</h3>
      {birth && <p>Geboren: {birth}</p>}
      {death && <p>Verstorben: {death}</p>}
      {member.note && <p>{member.note}</p>}
      {member.photoUrl && (
        <p>
          <a href={member.photoUrl} target="_blank" rel="noreferrer">Foto ansehen</a>
        </p>
      )}
    </li>
  );
}

export default function MembersControls() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [isListOpen, setIsListOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<MemberForm>(EMPTY_FORM);

  async function loadMembers() {
    setIsLoading(true);
    setRequestError(null);
    try {
      const response = await getMembers();
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

  function toggleMembers() {
    const willOpen = !isListOpen;
    setIsListOpen(willOpen);
    setIsFormOpen(false);
    if (willOpen && members === null) void loadMembers();
  }

  function openForm() {
    setIsListOpen(false);
    setFormError(null);
    setIsFormOpen(true);
  }

  function updateForm(field: keyof MemberForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      const response = await createMember(request);
      if (response.status !== 201) {
        setFormError('Die Person konnte nicht angelegt werden. Bitte prüfe die Eingaben.');
        return;
      }
      setMembers((current) => [response.data, ...(current ?? [])]);
      setIsFormOpen(false);
      setIsListOpen(true);
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
          onClick={toggleMembers}
        >
          Personen
        </button>
        <button className="members-button" type="button" onClick={openForm}>
          Person hinzufügen
        </button>
      </div>

      {isListOpen && (
        <section className="members-panel" id="members-panel" aria-label="Personenliste">
          <header className="members-panel-header">
            <h2>Personen</h2>
            <button type="button" aria-label="Liste schließen" onClick={() => setIsListOpen(false)}>
              ×
            </button>
          </header>
          <div className="members-panel-body" aria-live="polite">
            {isLoading && <p className="members-loading">Mitglieder werden geladen …</p>}
            {requestError && (
              <div className="members-error" role="alert">
                <p>{requestError}</p>
                <button type="button" onClick={() => void loadMembers()}>Erneut versuchen</button>
              </div>
            )}
            {!isLoading && !requestError && members?.length === 0 && (
              <p className="members-empty">Noch keine Personen angelegt.</p>
            )}
            {!isLoading && !requestError && members && members.length > 0 && (
              <ul className="member-list">
                {members.map((member) => <MemberDetails key={member.id} member={member} />)}
              </ul>
            )}
          </div>
        </section>
      )}

      {isFormOpen && (
        <div className="member-dialog-backdrop">
          <section className="member-dialog" role="dialog" aria-modal="true" aria-labelledby="member-form-title">
            <header className="member-dialog-header">
              <h2 id="member-form-title">Person hinzufügen</h2>
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
    </div>
  );
}
