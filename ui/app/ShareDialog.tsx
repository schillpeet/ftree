'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  getTreeAccess,
  revokeTreeAccess,
  shareTree,
  transferTreeOwnership,
  type FamilySummary,
  type TreeAccessEntry,
  type TreeInvitation,
  type TreeRole,
} from '../lib/api/generated/members';
import { useLanguage, useT } from './i18n';
import { CopyIcon, TrashIcon } from './icons';
import { PanelShell, usePanelPin } from './PersonPanel';
import { CENTRE, type Offset } from './panelPosition';
import { useMe } from './Permissions';
import { problemCode } from './problems';
import { INVITE_ROLES, canTransferTo, isLastOwner, isSelf, plausibleEmail, roleChoices, shareProblem, type ShareProblem } from './share';
import './share.css';

// What a row is being asked: removal, or the hand-over of the ownership.
type Pending = { kind: 'remove' | 'transfer'; userId: string };

// Who has access to the open tree, with the owner's tools: invite by email (nothing is sent; the text with the link is
// copied), change a role, remove access, hand the tree over. Behaves like the other panels (drag, pin) but stays open
// when clicking elsewhere, so an invitation is not lost.
export default function ShareDialog({
  family,
  onClose,
  onChanged,
}: {
  family: FamilySummary;
  onClose: () => void;
  // The ownership changed, which can change what the caller may do here.
  onChanged: () => void;
}) {
  const t = useT();
  const text = t.share;
  const [language] = useLanguage();
  const me = useMe();
  const [pin, setPin] = usePanelPin('ftree.sharePanelPin');
  // Beside the family card instead of on top of it.
  const [moved, setMoved] = useState<Offset>({ x: 40, y: 40 });
  const [entries, setEntries] = useState<TreeAccessEntry[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TreeRole>('editor');
  const [isBusy, setIsBusy] = useState(false);
  const [problem, setProblem] = useState<ShareProblem | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [invitation, setInvitation] = useState<TreeInvitation | null>(null);
  const [copied, setCopied] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await getTreeAccess(family.id);
      if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
      setEntries(response.data);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, [family.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the list once the dialog opens
    void load();
  }, [load]);

  // Runs one change: its problem is shown, its success reloads the list.
  async function run(action: () => Promise<{ status: number; data: unknown }>, succeeded: number, then?: (data: unknown) => void) {
    setIsBusy(true);
    setProblem(null);
    try {
      const response = await action();
      if (response.status !== succeeded) return setProblem(shareProblem(problemCode(response.data)));
      then?.(response.data);
      setPending(null);
      await load();
    } catch {
      setProblem('failed');
    } finally {
      setIsBusy(false);
    }
  }

  // Also asks for the text of someone already invited: sharing again with the same role changes nothing.
  const give = (who: string, to: TreeRole) =>
    run(
      () => shareTree(family.id, { email: who, role: to }, { headers: { 'Accept-Language': language } }),
      200,
      (data) => {
        setInvitation(data as TreeInvitation);
        setCopied(null);
      },
    );

  function invite(event: FormEvent) {
    event.preventDefault();
    if (!plausibleEmail(email)) return setProblem('invalid');
    void give(email.trim(), role).then(() => setEmail(''));
  }

  async function copy() {
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(invitation.text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const transferOwnership = (userId: string) =>
    run(() => transferTreeOwnership(family.id, { userId }), 204, () => {
      setInvitation(null);
      onChanged();
    });

  return (
    <PanelShell
      label={text.title(family.name)}
      closeLabel={text.close}
      autoFocusClose
      onClose={onClose}
      offset={pin ?? moved}
      onMove={(next) => (pin ? setPin(next) : setMoved(next))}
      pinned={!!pin}
      onPinnedChange={(pinned) => {
        if (pinned) setPin(moved);
        else {
          setMoved(pin ?? CENTRE);
          setPin(null);
        }
      }}
      className="share-panel"
    >
      <section className="person-group">
        <h3>{text.people}</h3>
        {!entries && !loadFailed && <p className="person-muted">{text.loading}</p>}
        {loadFailed && (
          <p className="person-error" role="alert">
            {text.loadFailed}{' '}
            <button type="button" className="person-link-button" onClick={() => void load()}>
              {t.retry}
            </button>
          </p>
        )}
        {entries?.length === 0 && <p className="person-muted">{text.empty}</p>}
        <ul className="share-list">
          {entries?.map((entry) => {
            const last = isLastOwner(entry, entries);
            const confirming = pending?.userId === entry.userId;
            return (
              <li key={entry.userId} className="share-row">
                <div className="share-who">
                  <span className="share-name">
                    {entry.displayName}
                    {isSelf(entry, me?.email) && <span className="share-badge">{text.you}</span>}
                  </span>
                  <span className="share-email">{entry.email}</span>
                </div>
                <span className="share-status" data-status={entry.status}>
                  {text.status[entry.status]}
                </span>
                <select
                  className="share-select"
                  aria-label={text.roleOf(entry.displayName)}
                  value={entry.role}
                  disabled={isBusy || last}
                  onChange={(event) => void give(entry.email, event.target.value as TreeRole)}
                >
                  {roleChoices(entry).map((choice) => (
                    <option key={choice} value={choice} disabled={choice === 'owner'}>
                      {text.roles[choice]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="person-icon-button"
                  aria-label={text.removeOf(entry.displayName)}
                  title={last ? text.problems.lastOwner : text.remove}
                  disabled={isBusy || last}
                  onClick={() => setPending({ kind: 'remove', userId: entry.userId })}
                >
                  <TrashIcon />
                </button>
                <div className="share-row-tools">
                  {entry.status === 'invited' && (
                    <button type="button" className="person-link-button" disabled={isBusy} onClick={() => void give(entry.email, entry.role)}>
                      {text.showInvitation}
                    </button>
                  )}
                  {canTransferTo(entry) && (
                    <button
                      type="button"
                      className="person-link-button"
                      disabled={isBusy}
                      onClick={() => setPending({ kind: 'transfer', userId: entry.userId })}
                    >
                      {text.transfer}
                    </button>
                  )}
                </div>
                {confirming && (
                  <div className="share-confirm" role="alertdialog" aria-label={pending.kind === 'remove' ? text.remove : text.transfer}>
                    <p>
                      {pending.kind === 'remove' ? text.confirmRemove(entry.displayName) : text.confirmTransfer(entry.displayName)}
                    </p>
                    <button type="button" className="family-card-button" disabled={isBusy} onClick={() => setPending(null)}>
                      {text.cancel}
                    </button>
                    <button
                      type="button"
                      className="family-card-button family-card-danger"
                      disabled={isBusy}
                      autoFocus
                      onClick={() =>
                        void (pending.kind === 'remove'
                          ? run(() => revokeTreeAccess(family.id, entry.userId), 204)
                          : transferOwnership(entry.userId))
                      }
                    >
                      {text.confirm}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <form className="person-group share-invite" onSubmit={invite}>
        <h3>{text.inviteTitle}</h3>
        <div className="share-invite-fields">
          <label className="person-field">
            {text.email}
            <input
              type="email"
              value={email}
              maxLength={320}
              required
              placeholder={text.emailPlaceholder}
              autoComplete="off"
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="person-field">
            {text.role}
            <select value={role} onChange={(event) => setRole(event.target.value as TreeRole)}>
              {INVITE_ROLES.map((choice) => (
                <option key={choice} value={choice}>
                  {text.roles[choice]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" className="family-card-button family-card-primary" disabled={isBusy}>
          {isBusy ? text.sending : text.invite}
        </button>
      </form>

      {problem && (
        <p className="person-error" role="alert">
          {text.problems[problem]}
        </p>
      )}

      {invitation && (
        <section className="person-group share-invitation">
          <h3>{text.invitationFor(invitation.access.displayName)}</h3>
          <p className="person-muted">{text.invitationHint}</p>
          <textarea className="share-text" readOnly rows={7} value={invitation.text} aria-label={text.invitation} onFocus={(event) => event.target.select()} />
          <div className="share-copy">
            <button type="button" className="family-card-button" onClick={() => void copy()}>
              <CopyIcon />
              {copied ? text.copied : text.copy}
            </button>
            {copied === false && (
              <span className="person-error" role="alert">
                {text.copyFailed}
              </span>
            )}
          </div>
        </section>
      )}
    </PanelShell>
  );
}
