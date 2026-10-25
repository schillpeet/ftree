'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { createFamily, type FamilySummary } from '../lib/api/generated/members';
import { CloseIcon, DiceIcon } from './icons';
import { useT } from './i18n';
import { planTestFamily } from './testFamilyPlan';

const MAX_PERSONS = 250;
const MAX_GENERATIONS = 10;
const MAX_CHILDREN = 3;

function suggestedFamilyName(families: FamilySummary[] | null, prefix: string) {
  const existing = new Set(families?.map((family) => family.name.toLocaleLowerCase()) ?? []);
  let number = 1;
  while (existing.has(`${prefix} ${number}`.toLocaleLowerCase())) number++;
  return `${prefix} ${number}`;
}

// The test family generator in the families board: a button that unfolds its form below it. The board closes
// it together with itself, on Escape or a press outside.
export default function RandomFamilyPanel({
  families,
  onCreated,
}: {
  families: FamilySummary[] | null;
  onCreated: (family: FamilySummary) => void;
}) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [totalUsers, setTotalUsers] = useState(12);
  const [generationCount, setGenerationCount] = useState(3);
  const [minChildren, setMinChildren] = useState(0);
  const [maxChildren, setMaxChildren] = useState(3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const plan = useMemo(
    () => planTestFamily(totalUsers, generationCount, minChildren, maxChildren),
    [totalUsers, generationCount, minChildren, maxChildren],
  );
  const familyName = name ?? suggestedFamilyName(families, t.random.namePrefix);

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
        setError(t.random.exists);
        return;
      }
      if (response.status !== 201) {
        setError(t.random.settingsFailed);
        return;
      }
      onCreated(response.data);
      setSuccess(t.random.created(response.data.name, response.data.memberCount, response.data.generationCount));
      setName(null);
    } catch {
      setError(t.random.saveFailed);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="random-family-control">
      <button
        type="button"
        disabled={isGenerating}
        aria-expanded={isOpen}
        aria-controls="random-family-panel"
        onClick={() => setIsOpen(!isOpen)}
      >
        <DiceIcon />
        {t.random.generate}
      </button>

      {isOpen && (
        <section className="random-family-panel" id="random-family-panel" aria-label={t.random.title}>
          <header className="random-family-header">
            <h3>{t.random.title}</h3>
            <button type="button" aria-label={t.random.close} disabled={isGenerating} onClick={() => setIsOpen(false)}>
              <CloseIcon />
            </button>
          </header>
          <form className="random-family-form" onSubmit={generateFamily}>
            <label className="member-field">
              {t.random.name}
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
              {t.random.people}
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
              {t.random.generations}
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
                {t.random.minChildren}
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
                {t.random.maxChildren}
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
              {t.random.hint(MAX_PERSONS, MAX_GENERATIONS, MAX_CHILDREN)}
            </p>
            {plan === null && (
              <p className="member-form-error" role="alert">
                {t.random.impossible}
              </p>
            )}
            {error && <p className="member-form-error" role="alert">{error}</p>}
            {success && <p className="random-family-success" role="status">{success}</p>}
            <div className="member-form-actions">
              <button type="submit" disabled={!plan || isGenerating || !familyName.trim()}>
                {isGenerating ? t.random.creating : t.random.submit}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
