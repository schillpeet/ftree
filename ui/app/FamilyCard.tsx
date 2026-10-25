'use client';

import { useRef, useState, type FormEvent } from 'react';
import {
  anonymizeFamily,
  deleteFamily,
  deleteFamilyPhoto,
  getExportFamilyUrl,
  getGetFamilyPhotoUrl,
  renameFamily,
  setFamilyPhotoFit,
  uploadFamilyPhoto,
  type FamilySummary,
  type Member,
  type PhotoFit,
} from '../lib/api/generated/members';
import { generationRows } from './generations';
import { useT } from './i18n';
import { CopyIcon, DownloadIcon, PhotoIcon, PhotoOffIcon, TrashIcon, UploadIcon, UsersIcon } from './icons';
import { PanelShell, RelativeChip, usePanelPin } from './PersonPanel';
import { CENTRE, type Offset } from './panelPosition';
import { toJpeg, usePhotoPreview } from './MemberFields';
import { Can, useCan } from './Permissions';

export type FamilyCardMode = 'view' | 'edit';

// Overview of the shown family: its members by generation, the oldest first. Behaves like the person
// panel (drag, pin, closes on a click outside unless pinned) with a position of its own, and edits
// the family in place: photo, name, anonymized copy, delete.
export default function FamilyCard({
  family,
  members,
  mode,
  onModeChange,
  onClose,
  photoOf,
  onOpenMember,
  onChanged,
  onCreated,
  loadError,
  onRetry,
}: {
  family: FamilySummary;
  members: Member[] | null;
  mode: FamilyCardMode;
  onModeChange: (mode: FamilyCardMode) => void;
  onClose: () => void;
  photoOf: (member: Member) => string | null | undefined;
  onOpenMember: (id: string) => void;
  // The family was renamed or deleted; reload the families.
  onChanged: () => void;
  onCreated: (family: FamilySummary) => void;
  loadError: string | null;
  onRetry: () => void;
}) {
  const t = useT();
  const canEdit = useCan('family.edit');
  const canExport = useCan('family.export');
  const [pin, setPin] = usePanelPin('ftree.familyPanelPin');
  const [moved, setMoved] = useState<Offset>(CENTRE);
  const [name, setName] = useState(family.name);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Picked image (uploaded on save) and whether the stored one is to be removed.
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoFit, setPhotoFit] = useState<PhotoFit>(family.photoFit);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = usePhotoPreview(photoFile);
  const rows = generationRows(members ?? []);
  // The upload time makes a new photo a new (uncached) URL.
  const stored = family.photoUpdatedAt
    ? `${getGetFamilyPhotoUrl(family.id)}?v=${encodeURIComponent(family.photoUpdatedAt)}`
    : null;
  const photo = mode === 'edit' ? (preview ?? (removePhoto ? null : stored)) : stored;
  const fit = mode === 'edit' ? photoFit : family.photoFit;

  function edit() {
    setName(family.name);
    setPhotoFile(null);
    setRemovePhoto(false);
    setPhotoFit(family.photoFit);
    setError(null);
    onModeChange('edit');
  }

  function pickPhoto(file: File | null | undefined) {
    if (!file?.type.startsWith('image/')) return;
    setPhotoFile(file);
    setRemovePhoto(false);
  }

  // Renames first, then uploads or removes the photo and sets how it is shown; a failed step keeps the
  // card in edit mode.
  async function save(event: FormEvent) {
    event.preventDefault();
    const next = name.trim();
    setIsBusy(true);
    setError(null);
    try {
      if (next && next !== family.name) {
        const response = await renameFamily(family.id, { name: next });
        if (response.status === 409) return setError(t.familyExists(next));
        if (response.status === 404) return setError(t.families.gone);
        if (response.status !== 200) return setError(t.families.renameFailed);
      }
      if (photoFile) {
        if ((await uploadFamilyPhoto(family.id, await toJpeg(photoFile))).status !== 204) return setError(t.familyCard.photoFailed);
      } else if (removePhoto && stored) {
        if ((await deleteFamilyPhoto(family.id)).status !== 204) return setError(t.familyCard.photoFailed);
      }
      if (photoFit !== family.photoFit && (await setFamilyPhotoFit(family.id, { photoFit })).status !== 200) {
        return setError(t.familyCard.fitFailed);
      }
      onModeChange('view');
    } catch {
      setError(t.familyCard.photoFailed);
    } finally {
      setIsBusy(false);
      onChanged();
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
      onEdit={mode === 'view' && canEdit ? edit : undefined}
      actions={
        canExport && (
          <a
            className="person-icon-button"
            href={getExportFamilyUrl(family.id)}
            download
            aria-label={t.families.download(family.name)}
            title={t.families.downloadTitle}
          >
            <DownloadIcon />
          </a>
        )
      }
      className="family-card"
    >
      {mode === 'edit' ? (
        <form className="family-card-edit" onSubmit={save}>
          {/* Dropping an image on the field picks it like the file chooser does. */}
          <label
            className={`family-card-drop${isDragging ? ' family-card-drop-active' : ''}`}
            data-fit={photo ? fit : undefined}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              pickPhoto(event.dataTransfer.files[0]);
            }}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" />
            ) : (
              <span className="family-card-drop-hint">
                <UploadIcon />
                {t.familyCard.dropPhoto}
              </span>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={(event) => pickPhoto(event.target.files?.[0])} />
          </label>
          {photo && (
            <div className="family-card-fit" role="radiogroup" aria-label={t.familyCard.fit}>
              {(['cover', 'original'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={photoFit === option}
                  onClick={() => setPhotoFit(option)}
                >
                  {t.familyCard.fits[option]}
                </button>
              ))}
            </div>
          )}
          <label className="person-field">
            {t.familyCard.name}
            <input value={name} maxLength={100} required autoFocus onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="family-card-tools">
            <button type="button" className="family-card-button" disabled={isBusy} onClick={() => fileRef.current?.click()}>
              <PhotoIcon />
              {photo ? t.familyCard.changePhoto : t.familyCard.addPhoto}
            </button>
            {photo && (
              <button
                type="button"
                className="family-card-button"
                disabled={isBusy}
                onClick={() => {
                  setPhotoFile(null);
                  setRemovePhoto(true);
                }}
              >
                <PhotoOffIcon />
                {t.familyCard.removePhoto}
              </button>
            )}
          </div>
          <Can permission="family.manage">
            <div className="family-card-tools">
              <button type="button" className="family-card-button" disabled={isBusy} onClick={() => void anonymize()}>
                <CopyIcon />
                {t.families.anonymize}
              </button>
            </div>
          </Can>
          {error && <p className="person-error" role="alert">{error}</p>}
          <div className="family-card-actions">
            <Can permission="family.manage">
              <button type="button" className="family-card-button family-card-danger" disabled={isBusy} onClick={() => void remove()}>
                <TrashIcon />
                {t.familyCard.delete}
              </button>
            </Can>
            <button type="button" className="family-card-button" disabled={isBusy} onClick={() => onModeChange('view')}>
              {t.familyCard.cancel}
            </button>
            <button type="submit" className="family-card-button family-card-primary" disabled={isBusy}>
              {isBusy ? t.saving : t.familyCard.save}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="family-card-cover" data-fit={photo ? fit : undefined} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo && <img src={photo} alt="" />}
          </div>
          <div className="family-card-hero">
            <span className="family-card-emblem" aria-hidden="true">
              <UsersIcon />
            </span>
            <h2 className="person-name">{family.name}</h2>
            <p className="family-card-stats">
              <span>{t.familyCard.members(members?.length ?? family.memberCount)}</span>
              <span>{t.familyCard.generations(rows.length || family.generationCount)}</span>
              <Can permission="family.manage">
                <span title={t.familyCard.slug}>{family.slug}</span>
              </Can>
            </p>
          </div>
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
