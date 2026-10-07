'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createFamily, type FamilySummary } from '../lib/api/generated/members';
import { planTestFamily } from './testFamilyPlan';

const MAX_TEST_USERS = 250;
const MAX_GENERATIONS = 10;
const MAX_CHILDREN = 3;

function suggestedFamilyName(families: FamilySummary[] | null) {
  const existing = new Set(families?.map((family) => family.name.toLocaleLowerCase()) ?? []);
  let number = 1;
  while (existing.has(`test-familie ${number}`)) number++;
  return `Test-Familie ${number}`;
}

export default function TestUsersPanel({
  families,
  isOpen,
  onToggle,
  onCreated,
}: {
  families: FamilySummary[] | null;
  isOpen: boolean;
  onToggle: () => void;
  onCreated: (family: FamilySummary) => void;
}) {
  const [name, setName] = useState<string | null>(null);
  const [totalUsers, setTotalUsers] = useState(12);
  const [generationCount, setGenerationCount] = useState(3);
  const [minChildren, setMinChildren] = useState(0);
  const [maxChildren, setMaxChildren] = useState(3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const plan = useMemo(
    () => planTestFamily(totalUsers, generationCount, minChildren, maxChildren),
    [totalUsers, generationCount, minChildren, maxChildren],
  );
  const familyName = name ?? suggestedFamilyName(families);

  useEffect(() => {
    if (!isOpen || isGenerating) return;
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
  }, [isOpen, isGenerating, onToggle]);

  async function generateUsers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!plan || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await createFamily({
        name: familyName.trim(),
        totalUsers,
        generationCount,
        minChildren,
        maxChildren,
      });
      if (response.status === 409) {
        setError('Eine Familie mit diesem Namen existiert bereits.');
        return;
      }
      if (response.status !== 201) {
        setError('Diese Familien-Einstellungen konnten nicht gespeichert werden.');
        return;
      }
      onCreated(response.data);
      setSuccess(
        `${response.data.name}: ${response.data.memberCount} Personen in ${response.data.generationCount} Generationen angelegt.`,
      );
      setName(null);
    } catch {
      setError('Die Familie konnte nicht gespeichert werden. Ist das BFF erreichbar?');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="test-users-control">
      <button
        className="debug-button"
        type="button"
        disabled={isGenerating}
        aria-expanded={isOpen}
        aria-controls="test-users-panel"
        ref={buttonRef}
        onClick={onToggle}
      >
        Testuser
      </button>

      {isOpen && (
        <section className="test-users-panel" id="test-users-panel" aria-label="Testuser anlegen" ref={panelRef}>
          <header className="members-panel-header">
            <h2>Testuser-Familie anlegen</h2>
            <button
              type="button"
              aria-label="Testuser-Board schließen"
              disabled={isGenerating}
              onClick={onToggle}
            >
              ×
            </button>
          </header>
          <form className="test-users-form" onSubmit={generateUsers}>
            <label className="member-field">
              Familienname
              <input
                autoComplete="off"
                maxLength={100}
                required
                disabled={isGenerating}
                value={familyName}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="member-field">
              Anzahl Testuser
              <input
                type="number"
                min={1}
                max={MAX_TEST_USERS}
                required
                disabled={isGenerating}
                value={totalUsers}
                onChange={(event) => setTotalUsers(Number(event.target.value))}
              />
            </label>
            <label className="member-field">
              Generationen
              <input
                type="number"
                min={1}
                max={MAX_GENERATIONS}
                required
                disabled={isGenerating}
                value={generationCount}
                onChange={(event) => setGenerationCount(Number(event.target.value))}
              />
            </label>
            <div className="test-users-child-range">
              <label className="member-field">
                Kinder mindestens
                <input
                  type="number"
                  min={0}
                  max={MAX_CHILDREN}
                  required
                  disabled={isGenerating}
                  value={minChildren}
                  onChange={(event) => setMinChildren(Number(event.target.value))}
                />
              </label>
              <label className="member-field">
                Kinder höchstens
                <input
                  type="number"
                  min={0}
                  max={MAX_CHILDREN}
                  required
                  disabled={isGenerating}
                  value={maxChildren}
                  onChange={(event) => setMaxChildren(Number(event.target.value))}
                />
              </label>
            </div>
            <p className="test-users-hint">
              Erstellt eine neue Familie samt Personen und Beziehungen. Maximal {MAX_TEST_USERS} Personen,{' '}
              {MAX_GENERATIONS} Generationen und {MAX_CHILDREN} Kinder pro Elternteil.
            </p>
            {plan === null && (
              <p className="member-form-error" role="alert">
                Diese Anzahl lässt sich mit den gewählten Generationen und Kinderzahlen nicht bilden.
              </p>
            )}
            {error && <p className="member-form-error" role="alert">{error}</p>}
            {success && <p className="test-users-success" role="status">{success}</p>}
            <div className="member-form-actions">
              <button type="submit" disabled={!plan || isGenerating || !familyName.trim()}>
                {isGenerating ? 'Familie wird angelegt …' : 'Familie speichern und anzeigen'}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
