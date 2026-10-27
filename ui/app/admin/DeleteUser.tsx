'use client';

import { useState, type FormEvent } from 'react';
import type { AdminFamily, AdminUser } from '../../lib/api/generated/members';
import { useT } from '../i18n';
import { deleteUser, transfer } from './accessActions';
import { confirmsPerson, ownerCandidates, soleOwnedTrees } from './adminData';

// "Löschen": trees only this person owns first get a new owner each, then the person's name or email has to be typed.
// The transfers run one after the other before the deletion, so a failure on the way leaves the person in place.
export default function DeleteUser({
  user,
  users,
  families,
  onClose,
  onDeleted,
}: {
  user: AdminUser;
  users: readonly AdminUser[];
  families: readonly AdminFamily[];
  onClose: () => void;
  onDeleted: (name: string) => void;
}) {
  const t = useT();
  const owned = soleOwnedTrees(user, families);
  const options = new Map(owned.map((tree) => [tree.familyId, ownerCandidates(users, user.id, tree.familyId)]));
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = (familyId: string) => picked[familyId] ?? options.get(familyId)?.[0]?.id ?? '';
  const ready = owned.every((tree) => chosen(tree.familyId)) && confirmsPerson(typed, user);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    for (const tree of owned) {
      const result = await transfer(tree.familyId, chosen(tree.familyId));
      if (!result.ok) {
        setBusy(false);
        return setError(t.admin.problems[result.problem]);
      }
    }
    const result = await deleteUser(user.id);
    setBusy(false);
    if (!result.ok) return setError(t.admin.problems[result.problem]);
    onDeleted(user.displayName);
  }

  return (
    <section className="glass admin-card" aria-labelledby="admin-delete">
      <h2 id="admin-delete">{t.admin.deletion.title(user.displayName)}</h2>
      <p className="admin-muted">{t.admin.deletion.hint}</p>
      <form className="admin-invite-form" onSubmit={(event) => void submit(event)}>
        {owned.length > 0 && <p className="admin-full">{t.admin.deletion.ownsTrees}</p>}
        {owned.map((tree) => {
          const candidates = options.get(tree.familyId) ?? [];
          return candidates.length === 0 ? (
            <p key={tree.familyId} className="admin-error admin-full">
              {t.admin.deletion.nobody(tree.familyName)}
            </p>
          ) : (
            <label key={tree.familyId}>
              {t.admin.deletion.newOwner(tree.familyName)}
              <select
                className="admin-select"
                value={chosen(tree.familyId)}
                disabled={busy}
                onChange={(event) => setPicked({ ...picked, [tree.familyId]: event.target.value })}
              >
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.displayName} ({t.account.roles[candidate.role]})
                  </option>
                ))}
              </select>
            </label>
          );
        })}
        <label className="admin-full">
          {t.admin.deletion.confirm(user.displayName, user.email)}
          <input
            className="admin-select"
            aria-label={t.admin.deletion.confirmLabel}
            autoComplete="off"
            autoFocus
            maxLength={320}
            value={typed}
            disabled={busy}
            onChange={(event) => setTyped(event.target.value)}
          />
        </label>
        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}
        <div className="admin-actions">
          <button type="button" className="family-card-button" disabled={busy} onClick={onClose}>
            {t.cancel}
          </button>
          <button type="submit" className="family-card-button family-card-danger" disabled={busy || !ready}>
            {t.admin.deletion.submit}
          </button>
        </div>
      </form>
    </section>
  );
}
