'use client';

import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import {
  createMember,
  getMembers,
  updateMemberRelatives,
  type Member,
} from '../lib/api/generated/members';
import { planTestFamily } from './testFamilyPlan';

const MAX_TEST_USERS = 250;
const MAX_GENERATIONS = 10;
const MAX_CHILDREN = 3;

export default function TestUsersPanel({
  setMembers,
}: {
  setMembers: Dispatch<SetStateAction<Member[] | null>>;
}) {
  const [isOpen, setIsOpen] = useState(false);
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

  useEffect(() => {
    if (!isOpen || isGenerating) return;
    function closeOnOutsidePress(event: PointerEvent) {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setIsOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, isGenerating]);

  async function generateUsers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!plan || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setSuccess(null);
    const created: Member[] = [];
    let phase = 'Testuser anlegen';

    try {
      for (const [index, person] of plan.entries()) {
        const response = await createMember({
          firstName: `Testuser ${String(index + 1).padStart(3, '0')}`,
          lastName: `Generation ${person.generation + 1}`,
          note: 'Automatisch generierter Testuser.',
        });
        if (response.status !== 201) throw new Error(`HTTP ${response.status}`);
        created.push(response.data);
      }

      phase = 'Generationen verknüpfen';
      for (let index = 0; index < created.length; index++) {
        const children = plan.flatMap((person, childIndex) =>
          person.parentIndex === index ? [created[childIndex].id] : [],
        );
        if (children.length === 0) continue;

        const response = await updateMemberRelatives(created[index].id, {
          parentIds: [],
          childIds: children,
          partnerIds: [],
        });
        if (response.status !== 204) throw new Error(`HTTP ${response.status}`);
      }

      phase = 'Baum aktualisieren';
      const response = await getMembers();
      if (response.status !== 200 || !Array.isArray(response.data)) {
        throw new Error(`HTTP ${response.status}`);
      }
      setMembers(response.data);
      setSuccess(`${created.length} Testuser in ${generationCount} Generationen wurden angelegt.`);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : 'Unbekannter Fehler';
      setError(`${phase} fehlgeschlagen (${reason}). ${created.length} von ${plan.length} Testusern wurden angelegt.`);

      if (created.length > 0) {
        try {
          const response = await getMembers();
          if (response.status !== 200 || !Array.isArray(response.data)) {
            throw new Error(`HTTP ${response.status}`);
          }
          setMembers(response.data);
        } catch (refreshCause) {
          const refreshReason = refreshCause instanceof Error ? refreshCause.message : 'Unbekannter Fehler';
          setError((message) => `${message} Der Baum konnte danach nicht neu geladen werden (${refreshReason}).`);
          const partial = created.map((member, index) => {
            const parentIndex = plan[index].parentIndex;
            return {
              ...member,
              parentIds: parentIndex === null ? [] : [created[parentIndex].id],
            };
          });
          setMembers((current) => {
            const existingIds = new Set(current?.map((member) => member.id) ?? []);
            return [...(current ?? []), ...partial.filter((member) => !existingIds.has(member.id))];
          });
        }
      }
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="test-users-control">
      <button
        className="members-button members-button-primary"
        type="button"
        disabled={isGenerating}
        aria-expanded={isOpen}
        aria-controls="test-users-panel"
        ref={buttonRef}
        onClick={() => setIsOpen((open) => !open)}
      >
        Testuser
      </button>

      {isOpen && (
        <section className="test-users-panel" id="test-users-panel" aria-label="Testuser anlegen" ref={panelRef}>
          <header className="members-panel-header">
            <h2>Testuser anlegen</h2>
            <button
              type="button"
              aria-label="Testuser-Board schließen"
              disabled={isGenerating}
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </header>
          <form className="test-users-form" onSubmit={generateUsers}>
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
              Erstellt neue Testpersonen samt Eltern-Kind-Beziehungen. Maximal {MAX_TEST_USERS} Personen, {MAX_GENERATIONS}{' '}
              Generationen und {MAX_CHILDREN} Kinder pro Elternteil.
            </p>
            {plan === null && (
              <p className="member-form-error" role="alert">
                Diese Anzahl lässt sich mit den gewählten Generationen und Kinderzahlen nicht bilden.
              </p>
            )}
            {error && <p className="member-form-error" role="alert">{error}</p>}
            {success && <p className="test-users-success" role="status">{success}</p>}
            <div className="member-form-actions">
              <button type="submit" disabled={!plan || isGenerating}>
                {isGenerating ? 'Testuser werden angelegt …' : 'Testuser anlegen'}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
