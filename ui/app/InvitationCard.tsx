'use client';

import { useState } from 'react';
import type { FamilySummary, Member } from '../lib/api/generated/members';
import { generationRows } from './generations';
import { useT } from './i18n';
import { CloseIcon } from './icons';
import { initialsOf, nameOf } from './names';
import './welcome.css';

// The first visit of a tree somebody shared: what it holds and, when the owner already linked the user to a person,
// "Du hängst schon im Baum als …" with a way out. The inviter is not known to the API and is not named.
export default function InvitationCard({
  family,
  members,
  onAccept,
  onNotMe,
}: {
  family: FamilySummary;
  members: Member[];
  onAccept: () => void;
  // Removes the link between the user and the person; rejects when that fails.
  onNotMe: () => Promise<void>;
}) {
  const t = useT();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const self = members.find((member) => member.id === family.selfMemberId);
  const year = self?.birthDate?.slice(0, 4) ?? null;

  async function notMe() {
    setIsBusy(true);
    setError(null);
    try {
      await onNotMe();
    } catch {
      setError(t.invitation.notMeFailed);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <>
      <div className="invitation-veil" aria-hidden="true" />
      <main className="glass invitation-card" aria-label={t.invitation.label}>
        <span className="welcome-eyebrow">{t.invitation.eyebrow}</span>
        <h1>
          {t.invitation.titleBefore}
          <em>{family.name}</em>
          {t.invitation.titleAfter}
        </h1>
        <div className="invitation-chips">
          <span className="invitation-chip">{t.invitation.people(members.length)}</span>
          <span className="invitation-chip">{t.familyCard.generations(generationRows(members).length)}</span>
        </div>
        {self ? (
          <div className="invitation-self">
            <span className="invitation-self-avatar" aria-hidden="true">
              {initialsOf(self)}
            </span>
            <span className="invitation-self-text">
              <strong>{t.invitation.alreadyIn}</strong>
              <span>{t.invitation.as(nameOf(self, t.members.unknown), year)}</span>
            </span>
            <button type="button" className="welcome-link" disabled={isBusy} onClick={() => void notMe()}>
              {t.invitation.notMe}
            </button>
          </div>
        ) : (
          family.selfMemberId === null && <p className="welcome-note">{t.invitation.unlinked}</p>
        )}
        {error && (
          <p className="welcome-error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="welcome-primary" autoFocus onClick={onAccept}>
          {t.invitation.accept}
        </button>
        <span className="invitation-note">{t.invitation.note}</span>
      </main>
    </>
  );
}

// After accepting: a small list of things to do first, each opening the place to do it; it can be dismissed.
export function InvitationTasks({
  onCheck,
  onPhoto,
  onBranch,
  onClose,
}: {
  onCheck: () => void;
  onPhoto: () => void;
  onBranch: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const tasks = [
    { key: 'check', run: onCheck },
    { key: 'photo', run: onPhoto },
    { key: 'branch', run: onBranch },
  ] as const;
  return (
    <aside className="glass invitation-tasks" aria-label={t.invitation.tasksLabel}>
      <button type="button" className="invitation-tasks-close" aria-label={t.invitation.tasksClose} onClick={onClose}>
        <CloseIcon />
      </button>
      <span className="welcome-eyebrow">{t.invitation.tasksEyebrow}</span>
      <p>{t.invitation.tasksIntro}</p>
      {tasks.map(({ key, run }) => (
        <button key={key} type="button" className="invitation-task" onClick={run}>
          <strong>{t.invitation.tasks[key].title}</strong>
          <span>{t.invitation.tasks[key].hint}</span>
        </button>
      ))}
    </aside>
  );
}
