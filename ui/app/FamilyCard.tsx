'use client';

import { useState, type FormEvent } from 'react';
import {
  anonymizeFamily,
  deleteFamily,
  getExportFamilyUrl,
  renameFamily,
  type FamilySummary,
  type Member,
} from '../lib/api/generated/members';
import { generationRows } from './generations';
import { useT } from './i18n';
import { DownloadIcon, UsersIcon } from './icons';
import { PanelShell, RelativeChip, usePanelPin } from './PersonPanel';
import { CENTRE, type Offset } from './panelPosition';

export type FamilyCardMode = 'view' | 'edit';

// Overview of the shown family: its members by generation, the oldest first. Behaves like the person
// panel (drag, pin, closes on a click outside unless pinned) with a position of its own, and edits
// the family in place: name, anonymized copy, archive (default only), delete.
export default function FamilyCard({
  family,
  members,
  isDefault,
  mode,
  onModeChange,
  onClose,
  photoOf,
  onOpenMember,
  onChanged,
  onCreated,
  onArchive,
  loadError,
  onRetry,
}: {
  family: FamilySummary;
  members: Member[] | null;
  isDefault: boolean;
  mode: FamilyCardMode;
  onModeChange: (mode: FamilyCardMode) => void;
  onClose: () => void;
  photoOf: (member: Member) => string | null | undefined;
  onOpenMember: (id: string) => void;
  // The family was renamed or deleted; reload the families.
  onChanged: () => void;
  onCreated: (family: FamilySummary) => void;
  onArchive: (onError: (message: string | null) => void) => Promise<void>;
  loadError: string | null;
  onRetry: () => void;
}) {
  const t = useT();
  const [pin, setPin] = usePanelPin('ftree.familyPanelPin');
  const [moved, setMoved] = useState<Offset>(CENTRE);
  const [name, setName] = useState(family.name);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rows = generationRows(members ?? []);

  function edit() {
    setName(family.name);
    setError(null);
    onModeChange('edit');
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const next = name.trim();
    if (!next || next === family.name) return onModeChange('view');
    setIsBusy(true);
    setError(null);
    try {
      const response = await renameFamily(family.id, { name: next });
      if (response.status === 409) return setError(t.familyExists(next));
      if (response.status === 404) return setError(t.families.gone);
      if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
      onChanged();
      onModeChange('view');
    } catch {
      setError(t.families.renameFailed);
    } finally {
      setIsBusy(false);
    }
  }

  // A new family with the same structure under random names; the original stays as it is.
  async function anonymize() {
    const copy = window.prompt(t.families.anonymizeName, t.families.anonymizeDefault(family.name))?.trim();
    if (!copy) return;
    setIsBusy(true);
    setError(null);
    try {
      const response = await anonymizeFamily(family.id, { name: copy });
      if (response.status === 409) return setError(t.familyExists(copy));
      if (response.status === 404) return setError(t.families.gone);
      if (response.status !== 201) throw new Error(`HTTP ${response.status}`);
      onCreated(response.data);
    } catch {
      setError(t.families.anonymizeFailed);
    } finally {
      setIsBusy(false);
    }
  }

  // Reloading the families falls back to "default" (or the first family) once this one is gone.
  async function remove() {
    if (!window.confirm(t.families.confirmDelete(family.name, family.memberCount))) return;
    setIsBusy(true);
    setError(null);
    try {
      const response = await deleteFamily(family.id);
      if (response.status !== 204) throw new Error(`HTTP ${response.status}`);
      onClose();
      onChanged();
    } catch {
      setError(t.families.deleteFailed(family.name));
      setIsBusy(false);
    }
  }

  return (
    <PanelShell
      label={t.familyCard.title}
      hideLabel
      closeLabel={t.familyCard.close}
      autoFocusClose={mode === 'view'}
      closeOnOutsideClick
      onClose={onClose}
      offset={pin ?? moved}
      onMove={(next) => (pin ? setPin(next) : setMoved(next))}
      pinned={!!pin}
      onPinnedChange={(pinned) => {
        if (pinned) setPin(moved);
        else {
          setMoved(pin ?? CENTRE);
          setPin(null);
        }
      }}
      onEdit={mode === 'view' ? edit : undefined}
      actions={
        <a
          className="person-icon-button"
          href={getExportFamilyUrl(family.id)}
          download
          aria-label={t.families.download(family.name)}
          title={t.families.downloadTitle}
        >
          <DownloadIcon />
        </a>
      }
      className="family-card"
    >
      <div className="family-card-cover" aria-hidden="true" />
      <div className="family-card-hero">
        <span className="family-card-emblem" aria-hidden="true">
          <UsersIcon />
        </span>
        {mode === 'view' && (
          <>
            <h2 className="person-name">{family.name}</h2>
            <p className="family-card-stats">
              <span>{t.familyCard.members(members?.length ?? family.memberCount)}</span>
              <span>{t.familyCard.generations(rows.length || family.generationCount)}</span>
            </p>
          </>
        )}
      </div>

      {mode === 'edit' ? (
        <form className="person-form" onSubmit={save}>
          <label className="person-field">
            {t.familyCard.name}
            <input value={name} maxLength={100} required autoFocus onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="family-card-tools">
            <button type="button" className="person-link-button" disabled={isBusy} onClick={() => void anonymize()}>
              {t.families.anonymize}
            </button>
            {isDefault && !!members?.length && (
              <button type="button" className="person-link-button" disabled={isBusy} onClick={() => void onArchive(setError)}>
                {t.members.archive}
              </button>
            )}
            <button type="button" className="person-link-button person-link-danger" disabled={isBusy} onClick={() => void remove()}>
              {t.familyCard.delete}
            </button>
          </div>
          {error && <p className="person-error" role="alert">{error}</p>}
          <div className="person-footer">
            <button type="button" disabled={isBusy} onClick={() => onModeChange('view')}>
              {t.familyCard.cancel}
            </button>
            <button type="submit" className="person-primary" disabled={isBusy}>
              {isBusy ? t.saving : t.familyCard.save}
            </button>
          </div>
        </form>
      ) : (
        <>
          {loadError && (
            <p className="person-error" role="alert">
              {loadError}{' '}
              <button type="button" className="person-link-button" onClick={onRetry}>
                {t.retry}
              </button>
            </p>
          )}
          {!members && !loadError && <p className="person-muted">{t.members.loading}</p>}
          {members?.length === 0 && <p className="person-muted">{t.familyCard.empty}</p>}
          {rows.map((row, index) => (
            <section className="person-group" key={index}>
              <h3 className="family-card-generation">
                {t.familyCard.generation(index + 1)}
                <span>{row.length}</span>
              </h3>
              <div className="person-chips">
                {row.map((member) => (
                  <RelativeChip
                    key={member.id}
                    member={member}
                    photo={photoOf(member)}
                    onClick={() => {
                      onOpenMember(member.id);
                      if (!pin) onClose();
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </PanelShell>
  );
}
