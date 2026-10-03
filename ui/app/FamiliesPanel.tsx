'use client';

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { deleteFamily, type FamilySummary } from '../lib/api/generated/members';

export default function FamiliesPanel({
  families,
  setFamilies,
  activeFamilyId,
  isLoading,
  error,
  isOpen,
  onToggle,
  onRetry,
  onSelect,
}: {
  families: FamilySummary[] | null;
  setFamilies: Dispatch<SetStateAction<FamilySummary[] | null>>;
  activeFamilyId: string | null;
  isLoading: boolean;
  error: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onRetry: () => void;
  onSelect: (familyId: string | null) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const activeFamily = families?.find((family) => family.id === activeFamilyId);

  useEffect(() => {
    if (!isOpen || deletingId) return;
    function closeOnOutsidePress(event: PointerEvent) {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) onToggle();
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onToggle();
    }
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, deletingId, onToggle]);

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
      if (family.id === activeFamilyId) onSelect(remaining[0]?.id ?? null);
    } catch {
      setDeleteError(`„${family.name}“ konnte nicht gelöscht werden. Ist das BFF erreichbar?`);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="families-control">
      <button
        className="members-button members-button-primary"
        type="button"
        aria-expanded={isOpen}
        aria-controls="families-panel"
        ref={buttonRef}
        onClick={onToggle}
      >
        Familien{activeFamily ? ` · ${activeFamily.name}` : ''}
      </button>

      {isOpen && (
        <section className="families-panel" id="families-panel" aria-label="Familien auswählen" ref={panelRef}>
          <header className="members-panel-header">
            <h2>Familien</h2>
            <button type="button" aria-label="Familien schließen" onClick={onToggle}>
              ×
            </button>
          </header>
          <div className="families-panel-body">
            {isLoading && <p className="members-loading">Familien werden geladen …</p>}
            {error && (
              <div className="members-error" role="alert">
                <p>{error}</p>
                <button type="button" onClick={onRetry}>Erneut versuchen</button>
              </div>
            )}
            {!isLoading && !error && families?.length === 0 && (
              <p className="members-empty">Noch keine Familien angelegt. Erstelle eine über „Testuser“.</p>
            )}
            {deleteError && <p className="member-form-error" role="alert">{deleteError}</p>}
            {!!families?.length && (
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
                        onToggle();
                      }}
                    >
                      <strong>{family.name}</strong>
                      <span>
                        {family.memberCount} Personen · {family.childCount} Kinder · {family.generationCount}{' '}
                        {family.generationCount === 1 ? 'Generation' : 'Generationen'}
                      </span>
                      {family.testSettings && (
                        <span>
                          Einstellung: {family.testSettings.totalUsers} Testuser in{' '}
                          {family.testSettings.generationCount} Generationen,{' '}
                          {family.testSettings.minChildren}–{family.testSettings.maxChildren} Kinder je Elternteil
                        </span>
                      )}
                    </button>
                    {family.name.toLocaleLowerCase() !== 'default' && (
                      <button
                        className="family-set-delete"
                        type="button"
                        aria-label={`${family.name} samt Personen löschen`}
                        disabled={deletingId !== null}
                        onClick={() => void removeFamily(family)}
                      >
                        {deletingId === family.id ? '…' : '×'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
