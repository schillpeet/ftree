'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createFamily, type FamilySummary } from '../lib/api/generated/members';
import { planTestFamily } from './testFamilyPlan';

const MAX_PERSONS = 250;
const MAX_GENERATIONS = 10;
const MAX_CHILDREN = 3;

function suggestedFamilyName(families: FamilySummary[] | null) {
  const existing = new Set(families?.map((family) => family.name.toLocaleLowerCase()) ?? []);
  let number = 1;
  while (existing.has(`zufallsfamilie ${number}`)) number++;
  return `Zufallsfamilie ${number}`;
}

export default function RandomFamilyPanel({
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

  async function generateFamily(event: FormEvent<HTMLFormElement>) {
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
    <div className="random-family-control">
      <button
        className="debug-button"
        type="button"
        disabled={isGenerating}
        aria-expanded={isOpen}
        aria-controls="random-family-panel"
        ref={buttonRef}
        onClick={onToggle}
      >
        Zufallsfamilie generieren
      </button>

      {isOpen && (
        <section className="random-family-panel" id="random-family-panel" aria-label="Zufallsfamilie anlegen" ref={panelRef}>
          <header className="members-panel-header">
            <h2>Zufallsfamilie anlegen</h2>
            <button
              type="button"
              aria-label="Zufallsfamilie-Board schließen"
              disabled={isGenerating}
              onClick={onToggle}
            >
              ×
            </button>
          </header>
          <form className="random-family-form" onSubmit={generateFamily}>
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
              Anzahl Personen
              <input
                type="number"
                min={1}
                max={MAX_PERSONS}
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
            <div className="random-family-child-range">
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
            <p className="random-family-hint">
              Erstellt eine neue Familie samt Personen und Beziehungen. Maximal {MAX_PERSONS} Personen,{' '}
              {MAX_GENERATIONS} Generationen und {MAX_CHILDREN} Kinder pro Elternteil.
            </p>
            {plan === null && (
              <p className="member-form-error" role="alert">
                Diese Anzahl lässt sich mit den gewählten Generationen und Kinderzahlen nicht bilden.
              </p>
            )}
            {error && <p className="member-form-error" role="alert">{error}</p>}
            {success && <p className="random-family-success" role="status">{success}</p>}
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
