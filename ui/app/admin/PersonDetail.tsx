'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import {
  getAdminAudit,
  updateAdminUser,
  type AdminFamily,
  type AdminUser,
  type AuditPage,
  type TreeRole,
  type UpdateAdminUserRequest,
} from '../../lib/api/generated/members';
import { useLanguage, useT } from '../i18n';
import { ChevronLeftIcon, CloseIcon, PencilIcon, TrashIcon, TreeIcon } from '../icons';
import { endSessions, revoke, share } from './accessActions';
import ActionMenu from './ActionMenu';
import ActivityList from './ActivityList';
import { initialsOf } from './adminData';
import DeleteUser from './DeleteUser';
import { LoadError } from './OverviewTab';
import RolePicker from './RolePicker';
import { useAdminLoad } from './useAdminLoad';

export type AvatarState = 'online' | 'seen' | 'invited' | 'never';

// A round avatar with the person's initials and, as a dot, whether they are online, invited, or away.
export function Avatar({ name, state, large }: { name: string; state: AvatarState; large?: boolean }) {
  return (
    <span className={large ? 'admin-avatar admin-avatar-large' : 'admin-avatar'} data-state={state} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}

type Result = { ok: boolean; problem?: keyof ReturnType<typeof useT>['admin']['problems'] };

// One person in full: their trees with a role each, their global rights, what they did lately, and, set apart, signing
// them out and deleting them. The rare changes (name, developer tools) wait in the "⋯" menu; the admin right comes only
// from the access file.
export default function PersonDetail({
  user,
  users,
  families,
  status,
  state,
  self,
  onChanged,
  onDeleted,
}: {
  user: AdminUser;
  users: readonly AdminUser[];
  families: readonly AdminFamily[] | null;
  status: string;
  state: AvatarState;
  self: boolean;
  onChanged: () => void;
  onDeleted: (name: string) => void;
}) {
  const t = useT();
  const [language] = useLanguage();
  const locale = language === 'de' ? 'de-DE' : 'en-GB';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const date = (value: string) => new Date(value).toLocaleDateString(locale, { dateStyle: 'medium' });
  const deletable = !self && !user.bootstrapAdmin;

  async function act(run: () => Promise<Result>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await run();
    if (!result.ok) setError(t.admin.problems[result.problem ?? 'failed']);
    setBusy(false);
    onChanged();
  }

  const update = (body: UpdateAdminUserRequest) =>
    act(async () => {
      try {
        return { ok: (await updateAdminUser(user.id, body)).status === 200 };
      } catch {
        return { ok: false };
      }
    });

  const changeRole = (familyId: string, role: TreeRole) =>
    act(async () => {
      const result = await share(familyId, user.email, role, language);
      return result.ok ? { ok: true } : { ok: false, problem: result.problem };
    });

  async function removeFrom(familyId: string, familyName: string) {
    if (!window.confirm(t.admin.people.confirmRemove(user.displayName, familyName))) return;
    await act(async () => {
      const result = await revoke(familyId, user.id);
      return result.ok ? { ok: true } : { ok: false, problem: result.problem };
    });
  }

  async function signOut() {
    if (!window.confirm(t.admin.people.confirmEndSessions(user.displayName))) return;
    await act(async () => {
      const result = await endSessions(user.id);
      if (result.ok) setNotice(t.admin.people.sessionsEnded(user.displayName));
      return result.ok ? { ok: true } : { ok: false, problem: result.problem };
    });
  }

  async function saveName() {
    if (renaming === null) return;
    const name = renaming;
    setRenaming(null);
    if (name.trim() !== (user.customName ?? '')) await update({ displayName: name });
  }

  return (
    <section className="glass admin-card admin-detail" aria-labelledby="admin-person">
      <Link className="admin-back" href="/admin/people">
        <ChevronLeftIcon />
        {t.admin.people.backToList}
      </Link>
      <div className="admin-detail-head">
        <Avatar name={user.displayName} state={state} large />
        <div className="admin-detail-title">
          {renaming === null ? (
            <h2 id="admin-person">
              {user.displayName}
              {self && <span className="admin-badge">{t.admin.people.you}</span>}
            </h2>
          ) : (
            <form
              className="admin-rename"
              onSubmit={(event) => {
                event.preventDefault();
                void saveName();
              }}
            >
              <input
                className="admin-select"
                id="admin-person"
                aria-label={t.admin.people.name}
                autoFocus
                maxLength={100}
                placeholder={t.admin.people.namePlaceholder}
                value={renaming}
                onChange={(event) => setRenaming(event.target.value)}
                onKeyDown={(event) => event.key === 'Escape' && setRenaming(null)}
              />
              <button type="submit" className="family-card-button">
                {t.admin.people.save}
              </button>
            </form>
          )}
          <span className="admin-muted admin-email">{user.email}</span>
          <span className="admin-muted" data-online={state === 'online' ? '' : undefined}>
            {status}
          </span>
        </div>
        <ActionMenu
          label={t.admin.people.more}
          disabled={busy}
          actions={[
            { label: t.admin.people.rename, icon: <PencilIcon />, onSelect: () => setRenaming(user.customName ?? '') },
            {
              label: user.canCreateTrees ? t.admin.people.revokeDev : t.admin.people.allowDev,
              hidden: user.admin,
              onSelect: () => void update({ canCreateTrees: !user.canCreateTrees }),
            },
          ]}
        />
      </div>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="admin-status" role="status">
          {notice}
        </p>
      )}

      <h3>{t.admin.people.trees}</h3>
      {user.trees.length === 0 ? (
        <p className="admin-muted">{t.admin.people.noTrees}</p>
      ) : (
        <ul className="admin-rows">
          {user.trees.map((tree) => (
            <li key={tree.familyId}>
              <TreeIcon />
              <Link href={`/${tree.familySlug}`} target="_blank" rel="noopener">
                {tree.familyName}
              </Link>
              <RolePicker
                value={tree.role}
                disabled={busy}
                label={t.admin.people.roleIn(tree.familyName)}
                onChange={(role) => void changeRole(tree.familyId, role)}
              />
              <button
                type="button"
                className="family-card-button admin-icon-button"
                disabled={busy}
                aria-label={t.admin.people.removeFrom(tree.familyName)}
                title={t.admin.people.removeFrom(tree.familyName)}
                onClick={() => void removeFrom(tree.familyId, tree.familyName)}
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3>{t.admin.people.rightsTitle}</h3>
      <div className="admin-facts">
        {user.bootstrapAdmin && <span className="admin-badge admin-badge-accent">{t.admin.people.adminByFile}</span>}
        {user.canCreateTrees && !user.admin && <span className="admin-badge">{t.admin.people.canCreate}</span>}
        {!user.admin && !user.canCreateTrees && <span className="admin-muted">{t.admin.people.noRights}</span>}
      </div>
      <p className="admin-muted admin-dates">
        {user.invitedAt && <span>{t.admin.people.invitedOn(date(user.invitedAt), user.invitedBy)}</span>}
        {user.firstSeen && <span>{t.admin.people.firstSeen(date(user.firstSeen))}</span>}
      </p>

      <h3>{t.admin.people.activity}</h3>
      <RecentActivity userId={user.id} users={users} />
      <Link className="admin-more-link" href={`/admin/audit?person=${user.id}`}>
        {t.admin.people.allActivity}
      </Link>

      {deleting && families ? (
        <DeleteUser user={user} users={users} families={families} onClose={() => setDeleting(false)} onDeleted={onDeleted} />
      ) : (
        <div className="admin-danger">
          <span>{t.admin.people.danger}</span>
          {!deletable && <span className="admin-muted">{t.admin.people.cannotDelete}</span>}
          <div className="admin-actions">
            <button type="button" className="family-card-button" disabled={busy} onClick={() => void signOut()}>
              {t.admin.people.endSessions}
            </button>
            {deletable && (
              <button
                type="button"
                className="family-card-button family-card-danger"
                disabled={busy || !families}
                onClick={() => setDeleting(true)}
              >
                <TrashIcon />
                {t.admin.people.delete}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// The latest audit entries a person made or that are about them, as a short timeline.
function RecentActivity({ userId, users }: { userId: string; users: readonly AdminUser[] }) {
  const t = useT();
  const load = useCallback(() => getAdminAudit({ userId, limit: 5 }), [userId]);
  const page = useAdminLoad<AuditPage>(load);
  const [now] = useState(() => Date.now());
  const names = new Map(users.map((user) => [user.email.toLowerCase(), user.displayName]));

  if (page.failed && !page.data) return <LoadError text={t.admin.people.activityFailed} onRetry={page.reload} />;
  if (!page.data) return <p className="admin-muted">{t.admin.loading}</p>;
  if (page.data.entries.length === 0) return <p className="admin-muted">{t.admin.people.activityEmpty}</p>;
  return <ActivityList entries={page.data.entries} names={names} now={now} />;
}
