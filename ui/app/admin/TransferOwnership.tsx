'use client';

import { useEffect, useState } from 'react';
import { getTreeAccess, type TreeAccessEntry } from '../../lib/api/generated/members';
import { useT } from '../i18n';
import { transfer } from './accessActions';

// "Besitz übertragen" for one tree: loads who has a role in it, then makes the chosen person its only owner.
export default function TransferOwnership({
  familyId,
  familyName,
  onClose,
  onDone,
}: {
  familyId: string;
  familyName: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = useT();
  const [entries, setEntries] = useState<TreeAccessEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    getTreeAccess(familyId)
      .then((response) => {
        if (!current) return;
        if (response.status === 200) setEntries(response.data);
        else setFailed(true);
      })
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [familyId]);

  // The current owners are listed last: handing a tree to somebody who owns it already changes nothing for them.
  const candidates = [...(entries ?? [])].sort((a, b) => Number(a.role === 'owner') - Number(b.role === 'owner'));
  const chosen = picked || candidates[0]?.userId || '';
  const target = candidates.find((entry) => entry.userId === chosen);

  async function submit() {
    if (!target || !window.confirm(t.admin.ownership.confirm(target.displayName, familyName))) return;
    setBusy(true);
    setError(null);
    const result = await transfer(familyId, target.userId);
    setBusy(false);
    if (!result.ok) return setError(t.admin.problems[result.problem]);
    onDone(t.admin.ownership.done(target.displayName, familyName));
  }

  return (
    <div className="admin-transfer">
      <strong>{t.admin.ownership.title(familyName)}</strong>
      <span className="admin-muted">{t.admin.ownership.hint}</span>
      {failed && <span className="admin-error">{t.admin.ownership.failed}</span>}
      {!entries && !failed && <span className="admin-muted">{t.admin.loading}</span>}
      {entries && candidates.length === 0 && <span className="admin-muted">{t.admin.ownership.nobody}</span>}
      {candidates.length > 0 && (
        <select
          className="admin-select"
          aria-label={t.admin.ownership.newOwner}
          value={chosen}
          disabled={busy}
          onChange={(event) => setPicked(event.target.value)}
        >
          {candidates.map((entry) => (
            <option key={entry.userId} value={entry.userId}>
              {entry.displayName} ({t.account.roles[entry.role]})
            </option>
          ))}
        </select>
      )}
      {error && (
        <span className="admin-error" role="alert">
          {error}
        </span>
      )}
      <div className="admin-actions">
        <button type="button" className="family-card-button" disabled={busy} onClick={onClose}>
          {t.cancel}
        </button>
        <button type="button" className="family-card-button" disabled={busy || !target} onClick={() => void submit()}>
          {t.admin.ownership.submit}
        </button>
      </div>
    </div>
  );
}
