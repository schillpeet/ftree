'use client';

import { useState } from 'react';
import type { FamilySummary, Member } from '../lib/api/generated/members';
import { generationRows } from './generations';
import { useT } from './i18n';
import { CloseIcon } from './icons';
import { initialsOf, nameOf } from './names';
import './welcome.css';

// A tree somebody shared, until the user answers the invitation: what it holds and, when the owner already linked the
// user to a person, "Du hängst schon im Baum als …" with a way out. They accept, put it aside for now, or decline it
// after asking once. The inviter is not known to the API and is not named.
export default function InvitationCard({
  family,
  members,
  onAccept,
  onLater,
  onDecline,
  onNotMe,
}: {
  family: FamilySummary;
  members: Member[];
  // Accepting and declining reject when the server refused.
  onAccept: () => Promise<void>;
  onLater: () => void;
  onDecline: () => Promise<void>;
  // Removes the link between the user and the person; rejects when that fails.
  onNotMe: () => Promise<void>;
}) {
  const t = useT();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);

  async function run(action: () => Promise<void>, failed: string) {
    setIsBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError(failed);
      setIsBusy(false);
    }
  }
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
        {/* Three lines, so the tree's name stands on its own in the middle. */}
        <h1 className="invitation-title">
          <span>{t.invitation.titleBefore}</span>
          <em>{family.name}</em>
          {t.invitation.titleAfter && <span>{t.invitation.titleAfter}</span>}
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
        {confirmDecline ? (
          <div className="invitation-confirm" role="group" aria-label={t.invitation.decline}>
            <p>{t.invitation.declineConfirm}</p>
            <div className="invitation-actions">
              <button
                type="button"
                className="welcome-primary invitation-danger"
                disabled={isBusy}
                onClick={() => void run(onDecline, t.invitation.declineFailed)}
              >
                {t.invitation.declineYes}
              </button>
              <button type="button" className="welcome-link" disabled={isBusy} onClick={() => setConfirmDecline(false)}>
                {t.cancel}
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="welcome-primary"
              autoFocus
              disabled={isBusy}
              onClick={() => void run(onAccept, t.invitation.acceptFailed)}
            >
              {t.invitation.accept}
            </button>
            <div className="invitation-actions">
              <button type="button" className="welcome-link" disabled={isBusy} onClick={onLater}>
                {t.invitation.later}
              </button>
              <button type="button" className="welcome-link" disabled={isBusy} onClick={() => setConfirmDecline(true)}>
                {t.invitation.decline}
              </button>
            </div>
          </>
        )}
        <span className="invitation-note">{t.invitation.note}</span>
      </main>
    </>
  );
}

// While the invitation is put aside: a small reminder that brings the card back.
export function InvitationPending({ family, onAnswer }: { family: FamilySummary; onAnswer: () => void }) {
  const t = useT();
  return (
    <aside className="glass invitation-pending" role="status">
      <span className="invitation-pending-text">
        <strong>{t.invitation.pending(family.name)}</strong>
        <span>{t.invitation.pendingHint}</span>
      </span>
      <button type="button" className="welcome-primary" onClick={onAnswer}>
        {t.invitation.answer}
      </button>
    </aside>
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
