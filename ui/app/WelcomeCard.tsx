'use client';

import { useState, type FormEvent } from 'react';
import type { FamilySummary } from '../lib/api/generated/members';
import { atFamilyLimit, themeOf } from './access';
import { useAppearance } from './appearance';
import { useLanguage, useT } from './i18n';
import { UploadIcon } from './icons';
import { initialsOf } from './names';
import { useMe } from './Permissions';
import { plantTree, PlantError, type PlantInput, type PlantProgress } from './plantTree';
import './welcome.css';

export type PartialPlant = { family: FamilySummary; input: PlantInput; progress: PlantProgress };

// The user's own card as it will hang in the tree: a scroll in 3D, a glass pill in TRON, with the scene's own classes.
function CardPreview({ firstName, lastName }: { firstName: string; lastName: string }) {
  const t = useT();
  const [appearance] = useAppearance();
  const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
  if (themeOf(appearance) === 'tron') {
    return (
      <div className="welcome-pill" aria-hidden="true">
        <span className="welcome-pill-avatar">{initialsOf({ firstName: firstName.trim(), lastName: lastName.trim() })}</span>
        <span className="welcome-pill-name">{name || t.welcome.yourName}</span>
      </div>
    );
  }
  return (
    <div className="scroll welcome-scroll" aria-hidden="true">
      <div className="scroll-rod" />
      <div className="scroll-sheet">
        <h3 className={name ? undefined : 'scroll-unknown'}>{name || t.welcome.yourName}</h3>
      </div>
      <div className="scroll-curl" />
    </div>
  );
}

// First start without any tree: asks for the user's name and plants a tree with them as its first person. A tree that
// was created but could not get its first person is handed on to `onPartial`, which opens it and offers the retry.
export default function WelcomeCard({
  families,
  onPlanted,
  onPartial,
  onImport,
}: {
  families: FamilySummary[] | null;
  onPlanted: (family: FamilySummary, memberId: string) => void;
  onPartial: (partial: PartialPlant) => void;
  // Opens the families board, where the GEDCOM import lives.
  onImport: () => void;
}) {
  const t = useT();
  const [language] = useLanguage();
  const me = useMe();
  const atLimit = atFamilyLimit(me, families);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function plant(event: FormEvent) {
    event.preventDefault();
    if (atLimit || isBusy || !firstName.trim()) return;
    const input = { firstName, lastName, language };
    setIsBusy(true);
    setError(null);
    try {
      const { family, memberId } = await plantTree(input);
      onPlanted(family, memberId);
    } catch (caught) {
      if (caught instanceof PlantError && caught.progress.family) {
        onPartial({ family: caught.progress.family, input, progress: caught.progress });
      } else {
        setError(caught instanceof PlantError && caught.failure === 'treeLimit' ? t.welcome.limit : t.welcome.failed);
        setIsBusy(false);
      }
    }
  }

  return (
    <>
      <div className="welcome-veil" aria-hidden="true" />
      <form className="glass welcome-card" aria-label={t.welcome.label} onSubmit={(event) => void plant(event)}>
        <span className="welcome-eyebrow">{t.welcome.eyebrow}</span>
        <h1>
          {t.welcome.titleLead}
          <em>{t.welcome.titleEmphasis}</em>
        </h1>
        <p className="welcome-lead">{t.welcome.lead}</p>
        <div className="welcome-preview">
          <CardPreview firstName={firstName} lastName={lastName} />
        </div>
        <div className="welcome-fields">
          <label className="welcome-field">
            {t.welcome.firstName}
            <input
              value={firstName}
              maxLength={100}
              required
              autoFocus
              autoComplete="given-name"
              onChange={(event) => setFirstName(event.target.value)}
            />
          </label>
          <label className="welcome-field">
            {t.welcome.lastName}
            <input value={lastName} maxLength={100} autoComplete="family-name" onChange={(event) => setLastName(event.target.value)} />
          </label>
        </div>
        {atLimit && <p className="welcome-note">{t.welcome.limit}</p>}
        {error && (
          <p className="welcome-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="welcome-primary" disabled={atLimit || isBusy || !firstName.trim()}>
          {isBusy ? t.welcome.planting : t.welcome.plant}
        </button>
        <button type="button" className="welcome-link" onClick={onImport}>
          <UploadIcon />
          {t.welcome.importGedcom}
        </button>
      </form>
    </>
  );
}

// Shown in the new tree when planting stopped after the family was created: adds the user (or only the missing link)
// to that family, never a second one.
export function PlantRetry({ partial, onPlanted }: { partial: PartialPlant; onPlanted: (family: FamilySummary, memberId: string) => void }) {
  const t = useT();
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState(partial.progress);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setIsBusy(true);
    setError(null);
    try {
      const { family, memberId } = await plantTree(partial.input, progress);
      onPlanted(family, memberId);
    } catch (caught) {
      if (caught instanceof PlantError) setProgress({ ...progress, ...caught.progress });
      setError(t.welcome.failed);
      setIsBusy(false);
    }
  }

  return (
    <div className="glass welcome-retry" role="alert">
      <p>{t.welcome.partial(partial.family.name)}</p>
      {error && <p className="welcome-error">{error}</p>}
      <button type="button" className="welcome-primary" disabled={isBusy} onClick={() => void retry()}>
        {isBusy ? t.welcome.adding : t.welcome.addMe}
      </button>
    </div>
  );
}
