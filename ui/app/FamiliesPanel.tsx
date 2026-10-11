'use client';

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  DownloadIcon, EyeIcon, EyeOffIcon, PencilIcon, TrashIcon, UploadIcon, UsersIcon, CloseIcon,
} from './icons';
import { deleteFamily, getExportFamilyUrl, importFamily, renameFamily, type FamilySummary } from '../lib/api/generated/members';

export default function FamiliesPanel({
  families,
  setFamilies,
  activeFamilyId,
  isLoading,
  error,
  isOpen,
  onClose,
  onRetry,
  onSelect,
  onChosen,
  onToggleVisibility,
  onImported,
}: {
  families: FamilySummary[] | null;
  setFamilies: Dispatch<SetStateAction<FamilySummary[] | null>>;
  activeFamilyId: string | null;
  isLoading: boolean;
  error: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  onSelect: (familyId: string | null) => void;
  // A family was picked from the list (not merely switched by a deletion).
  onChosen: () => void;
  onToggleVisibility: (familyId: string) => void;
  onImported: (family: FamilySummary) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const activeFamily = families?.find((family) => family.id === activeFamilyId);

  useEffect(() => {
    if (!isOpen || deletingId || isImporting) return;
    function closeOnOutsidePress(event: PointerEvent) {
      const target = event.target as Node;
      // The menu switches boards itself.
      if (!panelRef.current?.contains(target) && !(target as Element).closest?.('.dashboard-menu')) onClose();
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, deletingId, isImporting, onClose]);

  // Always creates a new family; the BFF reads the file and refuses taken names.
  async function importGedcom(file: File) {
    const name = window.prompt(
      'Unter welchem Namen soll die GEDCOM-Datei als neue Familie angelegt werden?',
      file.name.replace(/\.ged$/i, ''),
    )?.trim();
    if (!name) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const response = await importFamily({ name, gedcom: await file.text() });
      if (response.status === 409) {
        setImportError(`Eine Familie „${name}“ existiert bereits.`);
        return;
      }
      if (response.status === 400) {
        setImportError(
          'Die Datei konnte nicht importiert werden: kein lesbares GEDCOM, mehr als 2000 Personen, ' +
            'jemand wäre sein eigener Vorfahre oder der Name ist länger als 100 Zeichen.',
        );
        return;
      }
      if (response.status !== 201) throw new Error('Unexpected import response');
      onImported(response.data);
    } catch {
      setImportError('Die GEDCOM-Datei konnte nicht importiert werden. Ist das BFF erreichbar?');
    } finally {
      setIsImporting(false);
    }
  }

  async function removeFamily(family: FamilySummary) {
    const confirmed = window.confirm(
      `„${family.name}“ mit ${family.memberCount} Personen und allen Beziehungen endgültig löschen?`,
    );
    if (!confirmed) return;

    setDeletingId(family.id);
    setDeleteError(null);
    try {
      const response = await deleteFamily(family.id);
      if (response.status !== 204) throw new Error(`HTTP ${response.status}`);
      const remaining = (families ?? []).filter((item) => item.id !== family.id);
      setFamilies(remaining);
      if (family.id === activeFamilyId) {
        onSelect(
          remaining.find((item) => item.name.toLocaleLowerCase() === 'default')?.id ?? remaining[0]?.id ?? null,
        );
      }
    } catch {
      setDeleteError(`„${family.name}“ konnte nicht gelöscht werden. Ist das BFF erreichbar?`);
    } finally {
      setDeletingId(null);
    }
  }

  async function rename(family: FamilySummary) {
    const name = window.prompt('Unter welchem Namen soll die Familie geführt werden?', family.name)?.trim();
    if (!name || name === family.name) return;
    setIsRenaming(true);
    setRenameError(null);
    try {
      const response = await renameFamily(family.id, { name });
      if (response.status === 409) {
        setRenameError(`Eine Familie „${name}“ existiert bereits.`);
        return;
      }
      if (response.status === 404) {
        setRenameError('Die Familie existiert nicht mehr.');
        return;
      }
      if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
      const renamed = response.data;
      setFamilies((current) => current?.map((item) => (item.id === renamed.id ? { ...item, name: renamed.name } : item)) ?? null);
    } catch {
      setRenameError('Die Familie konnte nicht umbenannt werden. Ist das BFF erreichbar?');
    } finally {
      setIsRenaming(false);
    }
  }

  if (!isOpen) return null;

  return (
    <section className="glass dashboard-board families-panel" id="families-panel" aria-label="Familien" ref={panelRef}>
      <header className="dashboard-board-header">
        <UsersIcon />
        <h2>Familien</h2>
        <button type="button" aria-label="Familien schließen" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>
      <div className="families-panel-body">
        {activeFamily && (
          <div className="family-current">
            <div className="family-current-line">
              <span>Ausgewählt</span>
              <button
                className="icon-button"
                type="button"
                aria-label="Familienname ändern"
                disabled={isRenaming}
                onClick={() => void rename(activeFamily)}
              >
                <PencilIcon />
              </button>
            </div>
            <strong>{activeFamily.name}</strong>
          </div>
        )}
        {renameError && <p className="member-form-error" role="alert">{renameError}</p>}
        <div className="family-set-import">
          <button type="button" disabled={isImporting} onClick={() => fileRef.current?.click()}>
            <UploadIcon />
            {isImporting ? 'GEDCOM wird importiert …' : 'GEDCOM importieren'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".ged"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void importGedcom(file);
            }}
          />
        </div>
        {isLoading && <p className="members-loading">Familien werden geladen …</p>}
        {error && (
          <div className="members-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={onRetry}>Erneut versuchen</button>
          </div>
        )}
        {!isLoading && !error && families?.length === 0 && (
          <p className="members-empty">Noch keine Familien angelegt. Erstelle eine über „Zufallsfamilie generieren“ unter Evolution oder importiere eine GEDCOM-Datei.</p>
        )}
        {deleteError && <p className="member-form-error" role="alert">{deleteError}</p>}
        {importError && <p className="member-form-error" role="alert">{importError}</p>}
        {!!families?.length && (
          <>
            <h3 className="dashboard-subhead">Alle Familien</h3>
            <ul className="family-set-list">
              {families.map((family) => (
                <li className="family-set-item" key={family.id}>
                  <button
                    type="button"
                    className="family-set-select"
                    aria-pressed={family.id === activeFamilyId}
                    disabled={deletingId !== null}
                    onClick={() => {
                      onSelect(family.id);
                      onChosen();
                    }}
                  >
                    <strong>{family.name}</strong>
                    <span>
                      {family.memberCount} Personen · {family.childCount} Kinder · {family.generationCount}{' '}
                      {family.generationCount === 1 ? 'Generation' : 'Generationen'}
                    </span>
                    {family.testSettings && (
                      <span>
                        Einstellung: {family.testSettings.totalUsers} Personen in{' '}
                        {family.testSettings.generationCount} Generationen,{' '}
                        {family.testSettings.minChildren}–{family.testSettings.maxChildren} Kinder je Elternteil
                      </span>
                    )}
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`${family.name} ${family.id === activeFamilyId ? 'ausblenden' : 'anzeigen'}`}
                    aria-pressed={family.id === activeFamilyId}
                    disabled={deletingId !== null}
                    onClick={() => onToggleVisibility(family.id)}
                  >
                    {family.id === activeFamilyId ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                  <a
                    className="icon-button"
                    href={getExportFamilyUrl(family.id)}
                    download
                    aria-label={`${family.name} als GEDCOM herunterladen`}
                    title="Als GEDCOM herunterladen"
                  >
                    <DownloadIcon />
                  </a>
                  <button
                    className="icon-button icon-button-danger"
                    type="button"
                    aria-label={`${family.name} samt Personen löschen`}
                    disabled={deletingId !== null}
                    onClick={() => void removeFamily(family)}
                  >
                    {deletingId === family.id ? '…' : <TrashIcon />}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
