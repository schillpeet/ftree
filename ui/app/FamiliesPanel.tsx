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
  onToggleVisibility,
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
  onToggleVisibility: (familyId: string) => void;
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

  return (
    <div className="families-control">
      <button
        className="members-button"
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
              <p className="members-empty">Noch keine Familien angelegt. Erstelle eine über „Zufallsfamilie generieren“.</p>
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
                          Einstellung: {family.testSettings.totalUsers} Personen in{' '}
                          {family.testSettings.generationCount} Generationen,{' '}
                          {family.testSettings.minChildren}–{family.testSettings.maxChildren} Kinder je Elternteil
                        </span>
                      )}
                    </button>
                    <button
                      className="family-set-visibility"
                      type="button"
                      aria-label={`${family.name} ${family.id === activeFamilyId ? 'ausblenden' : 'anzeigen'}`}
                      aria-pressed={family.id === activeFamilyId}
                      disabled={deletingId !== null}
                      onClick={() => onToggleVisibility(family.id)}
                    >
                      {family.id === activeFamilyId ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M3 3l18 18M10.6 5.2A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 3.9M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.4 3.8-1" />
                          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                        </svg>
                      )}
                    </button>
                    <button
                      className="family-set-delete"
                      type="button"
                      aria-label={`${family.name} samt Personen löschen`}
                      disabled={deletingId !== null}
                      onClick={() => void removeFamily(family)}
                    >
                      {deletingId === family.id ? '…' : '×'}
                    </button>
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
