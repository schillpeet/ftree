'use client';

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  CopyIcon, DownloadIcon, EyeIcon, EyeOffIcon, PencilIcon, TrashIcon, UploadIcon, UsersIcon, CloseIcon,
} from './icons';
import {
  anonymizeFamily, deleteFamily, getExportFamilyUrl, importFamily, renameFamily, reorderFamilies, type FamilySummary,
} from '../lib/api/generated/members';
import { useT } from './i18n';

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
  const t = useT();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isAnonymizing, setIsAnonymizing] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
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
      t.families.importName,
      file.name.replace(/\.ged$/i, ''),
    )?.trim();
    if (!name) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const response = await importFamily({ name, gedcom: await file.text() });
      if (response.status === 409) {
        setImportError(t.familyExists(name));
        return;
      }
      if (response.status === 400) {
        setImportError(t.families.importInvalid);
        return;
      }
      if (response.status !== 201) throw new Error('Unexpected import response');
      onImported(response.data);
    } catch {
      setImportError(t.families.importFailed);
    } finally {
      setIsImporting(false);
    }
  }

  async function removeFamily(family: FamilySummary) {
    const confirmed = window.confirm(t.families.confirmDelete(family.name, family.memberCount));
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
      setDeleteError(t.families.deleteFailed(family.name));
    } finally {
      setDeletingId(null);
    }
  }

  async function rename(family: FamilySummary) {
    const name = window.prompt(t.families.renameName, family.name)?.trim();
    if (!name || name === family.name) return;
    setIsRenaming(true);
    setRenameError(null);
    try {
      const response = await renameFamily(family.id, { name });
      if (response.status === 409) {
        setRenameError(t.familyExists(name));
        return;
      }
      if (response.status === 404) {
        setRenameError(t.families.gone);
        return;
      }
      if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
      const renamed = response.data;
      setFamilies((current) => current?.map((item) => (item.id === renamed.id ? { ...item, name: renamed.name } : item)) ?? null);
    } catch {
      setRenameError(t.families.renameFailed);
    } finally {
      setIsRenaming(false);
    }
  }

  // A new family with the same structure under random names; the original stays as it is.
  async function anonymize(family: FamilySummary) {
    const name = window.prompt(t.families.anonymizeName, t.families.anonymizeDefault(family.name))?.trim();
    if (!name) return;
    setIsAnonymizing(true);
    setRenameError(null);
    try {
      const response = await anonymizeFamily(family.id, { name });
      if (response.status === 409) {
        setRenameError(t.familyExists(name));
        return;
      }
      if (response.status === 404) {
        setRenameError(t.families.gone);
        return;
      }
      if (response.status !== 201) throw new Error(`HTTP ${response.status}`);
      onImported(response.data);
    } catch {
      setRenameError(t.families.anonymizeFailed);
    } finally {
      setIsAnonymizing(false);
    }
  }

  // Optimistic: the list shows the dropped order at once and goes back if the BFF refuses it.
  async function moveFamily(id: string, targetId: string) {
    const before = families;
    const moved = before?.find((family) => family.id === id);
    if (!before || !moved || id === targetId) return;
    const next = before.filter((family) => family.id !== id);
    next.splice(before.findIndex((family) => family.id === targetId), 0, moved);
    setFamilies(next);
    setReorderError(null);
    try {
      const response = await reorderFamilies({ familyIds: next.map((family) => family.id) });
      if (response.status !== 204) throw new Error(`HTTP ${response.status}`);
    } catch {
      setFamilies(before);
      setReorderError(t.families.reorderFailed);
    }
  }

  if (!isOpen) return null;
  const draggedIndex = families?.findIndex((family) => family.id === draggedId) ?? -1;

  return (
    <section className="glass dashboard-board families-panel" id="families-panel" aria-label={t.families.title} ref={panelRef}>
      <header className="dashboard-board-header">
        <UsersIcon />
        <h2>{t.families.title}</h2>
        <button type="button" aria-label={t.families.close} onClick={onClose}>
          <CloseIcon />
        </button>
      </header>
      <div className="families-panel-body">
        {activeFamily && (
          <div className="family-current">
            <div className="family-current-line">
              <span>{t.families.selected}</span>
              <div className="family-current-actions">
                <button
                  className="icon-button"
                  type="button"
                  aria-label={t.families.rename}
                  disabled={isRenaming}
                  onClick={() => void rename(activeFamily)}
                >
                  <PencilIcon />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={t.families.anonymize}
                  title={t.families.anonymize}
                  disabled={isAnonymizing}
                  onClick={() => void anonymize(activeFamily)}
                >
                  {isAnonymizing ? '…' : <CopyIcon />}
                </button>
              </div>
            </div>
            <strong>{activeFamily.name}</strong>
          </div>
        )}
        {renameError && <p className="member-form-error" role="alert">{renameError}</p>}
        <div className="family-set-import">
          <button type="button" disabled={isImporting} onClick={() => fileRef.current?.click()}>
            <UploadIcon />
            {isImporting ? t.families.importing : t.families.import}
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
        {isLoading && <p className="members-loading">{t.families.loading}</p>}
        {error && (
          <div className="members-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={onRetry}>{t.retry}</button>
          </div>
        )}
        {!isLoading && !error && families?.length === 0 && (
          <p className="members-empty">{t.families.empty}</p>
        )}
        {deleteError && <p className="member-form-error" role="alert">{deleteError}</p>}
        {importError && <p className="member-form-error" role="alert">{importError}</p>}
        {reorderError && <p className="member-form-error" role="alert">{reorderError}</p>}
        {!!families?.length && (
          <>
            <h3 className="dashboard-subhead">{t.families.all}</h3>
            <ul className="family-set-list">
              {families.map((family, index) => (
                <li
                  className="family-set-item"
                  key={family.id}
                  title={t.families.dragHint}
                  draggable
                  data-drop={
                    draggedIndex >= 0 && dropTargetId === family.id && draggedId !== family.id
                      ? draggedIndex < index ? 'after' : 'before'
                      : undefined
                  }
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', family.id);
                    setDraggedId(family.id);
                  }}
                  onDragOver={(event) => {
                    if (!draggedId) return;
                    event.preventDefault();
                    setDropTargetId(family.id);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggedId) void moveFamily(draggedId, family.id);
                  }}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setDropTargetId(null);
                  }}
                >
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
                      {t.families.summary(family.memberCount, family.childCount, family.generationCount)}
                    </span>
                    {family.testSettings && (
                      <span>
                        {t.families.settings(
                          family.testSettings.totalUsers,
                          family.testSettings.generationCount,
                          family.testSettings.minChildren,
                          family.testSettings.maxChildren,
                        )}
                      </span>
                    )}
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={family.id === activeFamilyId ? t.families.hide(family.name) : t.families.show(family.name)}
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
                    aria-label={t.families.download(family.name)}
                    title={t.families.downloadTitle}
                  >
                    <DownloadIcon />
                  </a>
                  <button
                    className="icon-button icon-button-danger"
                    type="button"
                    aria-label={t.families.delete(family.name)}
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
