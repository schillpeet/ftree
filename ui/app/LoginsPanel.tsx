'use client';

import { useEffect, useState } from 'react';
import { getUsers, type UserLogin } from '../lib/api/generated/members';
import { useLanguage, useT } from './i18n';
import { CloseIcon, SignInIcon } from './icons';

// Read-only list for admins: everyone the access file names with their last sign-in, then anyone else who signed in.
export default function LoginsPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [language] = useLanguage();
  const [users, setUsers] = useState<UserLogin[] | null>(null);
  const [failed, setFailed] = useState(false);
  // Raised by "Try again" to load once more.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    getUsers()
      .then((response) => {
        if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
        if (current) setUsers(response.data);
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [attempt]);

  function retry() {
    setFailed(false);
    setAttempt((value) => value + 1);
  }

  const when = (value: string) =>
    new Date(value).toLocaleString(language === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <section className="glass dashboard-board" id="logins-panel" aria-label={t.logins.title}>
      <header className="dashboard-board-header">
        <SignInIcon />
        <h2>{t.logins.title}</h2>
        <button type="button" aria-label={t.logins.close} onClick={onClose}>
          <CloseIcon />
        </button>
      </header>
      <div className="logins-panel-body">
        <p className="person-muted">{t.logins.hint}</p>
        {failed && (
          <div className="members-error" role="alert">
            <p>{t.logins.failed}</p>
            <button type="button" onClick={retry}>{t.retry}</button>
          </div>
        )}
        {!users && !failed && <p className="members-loading">{t.logins.loading}</p>}
        {users?.length === 0 && <p className="members-empty">{t.logins.empty}</p>}
        {!!users?.length && (
          <ul className="logins-list">
            {users.map((user) => (
              <li key={user.email} data-never={user.lastSeen ? undefined : ''}>
                <strong>{user.email}</strong>
                <span>
                  {user.lastSeen && user.firstSeen
                    ? `${t.logins.lastSeen(when(user.lastSeen))}, ${t.logins.firstSeen(when(user.firstSeen))}`
                    : t.logins.never}
                </span>
                {!user.listed && <span className="logins-unlisted">{t.logins.unlisted}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
