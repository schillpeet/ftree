'use client';

import { useState } from 'react';
import {
  getAdminFamilies,
  getAdminPresence,
  getAdminUsers,
  updateAdminUser,
  type AdminFamily,
  type AdminPresence,
  type AdminUser,
  type TreeRole,
  type UpdateAdminUserRequest,
} from '../../lib/api/generated/members';
import { useLanguage, useT } from '../i18n';
import { TrashIcon } from '../icons';
import { useMe } from '../Permissions';
import { endSessions, revoke, share } from './accessActions';
import { onlineTrees, personStatus, sortedPeople, type PersonStatus } from './adminData';
import DeleteUser from './DeleteUser';
import InvitePerson from './InvitePerson';
import { LoadError } from './OverviewTab';
import RolePicker from './RolePicker';
import { useAdminLoad } from './useAdminLoad';

// Who is online changes by the minute; the people themselves only when an admin changes them, so only presence refreshes.
const REFRESH_MS = 15_000;

// Every person with their trees and roles and whether they are around, with the rights and names an admin may change.
export default function PeopleTab() {
  const t = useT();
  const [language] = useLanguage();
  const locale = language === 'de' ? 'de-DE' : 'en-GB';
  const me = useMe();
  const users = useAdminLoad<AdminUser[]>(getAdminUsers);
  const presence = useAdminLoad<AdminPresence[]>(getAdminPresence, REFRESH_MS);
  const families = useAdminLoad<AdminFamily[]>(getAdminFamilies);
  // The id of the person an action runs for, so their controls wait.
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const people = users.data && sortedPeople(users.data);
  const online = presence.data ? onlineTrees(presence.data) : new Map<string, string[]>();
  const dateTime = (value: string) => new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

  async function act(id: string, run: () => Promise<{ ok: boolean; problem?: keyof typeof t.admin.problems }>) {
    setBusy(id);
    setError(null);
    setNotice(null);
    const result = await run();
    if (!result.ok) setError(t.admin.problems[result.problem ?? 'failed']);
    setBusy(null);
    users.reload();
  }

  const update = (user: AdminUser, body: UpdateAdminUserRequest) =>
    act(user.id, async () => {
      try {
        return { ok: (await updateAdminUser(user.id, body)).status === 200 };
      } catch {
        return { ok: false };
      }
    });

  const changeRole = (user: AdminUser, familyId: string, role: TreeRole) =>
    act(user.id, async () => {
      const result = await share(familyId, user.email, role, language);
      return result.ok ? { ok: true } : { ok: false, problem: result.problem };
    });

  async function removeFrom(user: AdminUser, familyId: string, familyName: string) {
    if (!window.confirm(t.admin.people.confirmRemove(user.displayName, familyName))) return;
    await act(user.id, async () => {
      const result = await revoke(familyId, user.id);
      return result.ok ? { ok: true } : { ok: false, problem: result.problem };
    });
  }

  async function signOut(user: AdminUser) {
    if (!window.confirm(t.admin.people.confirmEndSessions(user.displayName))) return;
    await act(user.id, async () => {
      const result = await endSessions(user.id);
      if (result.ok) setNotice(t.admin.people.sessionsEnded(user.displayName));
      return result.ok ? { ok: true } : { ok: false, problem: result.problem };
    });
  }

  function deleted(name: string) {
    setDeleting(null);
    setNotice(t.admin.deletion.done(name));
    users.reload();
    families.reload();
  }

  async function saveName(user: AdminUser) {
    const name = renaming?.id === user.id ? renaming.name : null;
    if (name === null) return;
    setRenaming(null);
    if (name.trim() !== (user.customName ?? '')) await update(user, { displayName: name });
  }

  const statusText = (status: PersonStatus) => {
    switch (status.kind) {
      case 'online':
        return t.admin.people.online(status.trees.join(', '));
      case 'seen':
        return t.admin.people.lastSeen(dateTime(status.at));
      case 'invited':
        return t.admin.people.invited;
      case 'never':
        return t.admin.people.never;
    }
  };

  return (
    <div className="admin-tab">
      <div className="admin-toolbar">
        <InvitePerson trees={families.data ?? []} onShared={users.reload} />
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
      {people && families.data && deleting && people.some((user) => user.id === deleting) && (
        <DeleteUser
          key={deleting}
          user={people.find((user) => user.id === deleting)!}
          users={people}
          families={families.data}
          onClose={() => setDeleting(null)}
          onDeleted={deleted}
        />
      )}
      <section className="glass admin-card" aria-labelledby="admin-people">
        <h2 id="admin-people">{t.admin.people.title}</h2>
        {users.failed && !people && <LoadError text={t.admin.people.failed} onRetry={users.reload} />}
        {!people && !users.failed && <p className="admin-muted">{t.admin.loading}</p>}
        {people?.length === 0 && <p className="admin-muted">{t.admin.people.empty}</p>}
        {!!people?.length && (
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">{t.admin.people.person}</th>
                <th scope="col">{t.admin.people.status}</th>
                <th scope="col">{t.admin.people.rights}</th>
                <th scope="col">{t.admin.people.trees}</th>
                <th scope="col">
                  <span className="admin-hidden">{t.admin.trees.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {people.map((user) => {
                const status = personStatus(user, online.get(user.id));
                const self = user.id === me?.id;
                const wait = busy === user.id;
                return (
                  <tr key={user.id}>
                    <td>
                      {renaming?.id === user.id ? (
                        <form
                          className="admin-rename"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void saveName(user);
                          }}
                        >
                          <input
                            className="admin-select"
                            aria-label={t.admin.people.name}
                            autoFocus
                            maxLength={100}
                            placeholder={t.admin.people.namePlaceholder}
                            value={renaming.name}
                            onChange={(event) => setRenaming({ id: user.id, name: event.target.value })}
                            onKeyDown={(event) => event.key === 'Escape' && setRenaming(null)}
                          />
                          <button type="submit" className="family-card-button">
                            {t.admin.people.save}
                          </button>
                        </form>
                      ) : (
                        <>
                          <strong>{user.displayName}</strong>
                          {self && <span className="admin-badge">{t.admin.people.you}</span>}
                          <button
                            type="button"
                            className="family-card-button admin-inline"
                            disabled={wait}
                            onClick={() => setRenaming({ id: user.id, name: user.customName ?? '' })}
                          >
                            {t.admin.people.rename}
                          </button>
                        </>
                      )}
                      <span className="admin-muted admin-email">{user.email}</span>
                    </td>
                    <td data-online={status.kind === 'online' ? '' : undefined}>{statusText(status)}</td>
                    <td>
                      <label className="admin-check">
                        <input
                          type="checkbox"
                          checked={user.canCreateTrees || user.admin}
                          disabled={wait || user.admin}
                          onChange={(event) => void update(user, { canCreateTrees: event.target.checked })}
                        />
                        {t.admin.people.canCreate}
                      </label>
                      <label className="admin-check">
                        <input
                          type="checkbox"
                          checked={user.admin}
                          disabled={wait || self || user.bootstrapAdmin}
                          onChange={(event) => void update(user, { admin: event.target.checked })}
                        />
                        {t.account.roles.admin}
                      </label>
                      {user.bootstrapAdmin && <span className="admin-muted">{t.admin.people.bootstrap}</span>}
                    </td>
                    <td>
                      {user.trees.length === 0 && <span className="admin-muted">{t.admin.people.noTrees}</span>}
                      {user.trees.map((tree) => (
                        <div key={tree.familyId} className="admin-tree-role">
                          <span>{tree.familyName}</span>
                          <RolePicker
                            value={tree.role}
                            disabled={wait}
                            label={t.admin.people.roleIn(tree.familyName)}
                            onChange={(role) => void changeRole(user, tree.familyId, role)}
                          />
                          <button
                            type="button"
                            className="family-card-button family-card-danger"
                            disabled={wait}
                            aria-label={t.admin.people.removeFrom(tree.familyName)}
                            onClick={() => void removeFrom(user, tree.familyId, tree.familyName)}
                          >
                            {t.admin.people.remove}
                          </button>
                        </div>
                      ))}
                    </td>
                    <td className="admin-actions">
                      <button type="button" className="family-card-button" disabled={wait} onClick={() => void signOut(user)}>
                        {t.admin.people.endSessions}
                      </button>
                      <button
                        type="button"
                        className="family-card-button family-card-danger"
                        disabled={wait || self || user.bootstrapAdmin || !families.data}
                        onClick={() => setDeleting(user.id)}
                      >
                        <TrashIcon />
                        {t.admin.people.delete}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
