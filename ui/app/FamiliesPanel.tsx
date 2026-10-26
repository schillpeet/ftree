'use client';

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { EyeIcon, EyeOffIcon, PencilIcon, PlusIcon, UploadIcon, UsersIcon, CloseIcon } from './icons';
import { importFamily, reorderFamilies, type FamilySummary } from '../lib/api/generated/members';
import RandomFamilyPanel from './RandomFamilyPanel';
import { useT } from './i18n';
import { useCan } from './Permissions';
import { problemCode } from './problems';

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
  onOpen,
  onToggleVisibility,
  onAdded,
  onCreate,
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
  // Shows the family and opens its card, where it can be edited.
  onOpen: (familyId: string) => void;
  onToggleVisibility: (familyId: string) => void;
  // A family was imported or generated here.
  onAdded: (family: FamilySummary) => void;
  // Opens the family card with an empty form for a new family.
  onCreate: () => void;
}) {
  const t = useT();
  // Admins and developers import and generate families; only admins reorder them.
  const canImport = useCan('family.create');
  const canGenerate = useCan('dev.tools');
  const manage = useCan('family.manage');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen || isImporting) return;
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
  }, [isOpen, isImporting, onClose]);

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
      if (response.status !== 201) {
        const code = problemCode(response.data);
        if (code === 'NAME_TAKEN') return setImportError(t.familyExists(name));
        if (code === 'INVALID_REQUEST' || code === 'VALIDATION_FAILED') return setImportError(t.families.importInvalid);
        throw new Error('Unexpected import response');
      }
      onAdded(response.data);
    } catch {
      setImportError(t.families.importFailed);
    } finally {
      setIsImporting(false);
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
        {canImport && (
          <div className="family-set-import">
            <button type="button" disabled={isImporting} onClick={onCreate}>
              <PlusIcon />
              {t.families.create}
            </button>
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
            {canGenerate && <RandomFamilyPanel families={families} onCreated={onAdded} />}
          </div>
        )}
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
                  title={manage ? t.families.dragHint : undefined}
                  draggable={manage}
                  data-drop={
                    draggedIndex >= 0 && dropTargetId === family.id && draggedId !== family.id
                      ? draggedIndex < index ? 'after' : 'before'
                      : undefined
                  }
                  onDragStart={(event) => {
                    if (!manage) return;
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
                    onClick={() => onSelect(family.id)}
                  >
                    <strong>{family.name}</strong>
                    <span>
                      {t.families.summary(family.memberCount, family.generationCount)}
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
                    onClick={() => onToggleVisibility(family.id)}
                  >
                    {family.id === activeFamilyId ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={t.families.openCard(family.name)}
                    title={t.families.openCard(family.name)}
                    onClick={() => onOpen(family.id)}
                  >
                    <PencilIcon />
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
