'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  deleteFamily,
  getAdminFamilies,
  getTrash,
  purgeTrashedFamily,
  restoreTrashedFamily,
  type AdminFamily,
  type TrashedFamily,
} from '../../lib/api/generated/members';
import { useLanguage, useT } from '../i18n';
import { TrashIcon } from '../icons';
import { Can, useCan } from '../Permissions';
import { pathOf } from '../slugRoute';
import { confirmsName, daysLeft } from './adminData';
import { LoadError } from './OverviewTab';
import { useAdminLoad } from './useAdminLoad';

// Every tree with who created it and how many hold each role, and below it the trash, where trees wait 30 days.
export default function TreesTab() {
  const t = useT();
  const [language] = useLanguage();
  const locale = language === 'de' ? 'de-DE' : 'en-GB';
  const mayManage = useCan('family.manage');
  const families = useAdminLoad<AdminFamily[]>(getAdminFamilies);
  const trash = useAdminLoad<TrashedFamily[]>(mayManage ? getTrash : noTrash);
  // `GET /admin/families` still lists trashed families, so the ones in the trash are left out here.
  const trashed = new Set(trash.data?.map((family) => family.id));
  const trees = families.data?.filter((family) => !trashed.has(family.id)) ?? null;
  // The id of the tree an action runs for, so its buttons wait.
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Days are counted from when the page opened; a day passing while it stays open is not worth a re-render.
  const [now] = useState(() => Date.now());
  const date = (value: string) => new Date(value).toLocaleDateString(locale, { dateStyle: 'medium' });

  // Runs one action on a tree, then reloads both lists, since a tree moves between them.
  async function act(id: string, run: () => Promise<{ status: number }>, failed: string) {
    setBusy(id);
    setError(null);
    try {
      if ((await run()).status !== 204) throw new Error('failed');
    } catch {
      setError(failed);
    } finally {
      setBusy(null);
      families.reload();
      trash.reload();
    }
  }

  function moveToTrash(family: AdminFamily) {
    if (!window.confirm(t.admin.trees.confirmTrash(family.name, family.memberCount))) return;
    void act(family.id, () => deleteFamily(family.id), t.admin.trees.trashFailed(family.name));
  }

  function restore(family: TrashedFamily) {
    void act(family.id, () => restoreTrashedFamily(family.id), t.admin.trash.restoreFailed(family.name));
  }

  // Cannot be undone, so the tree's name has to be typed, not just confirmed.
  function purge(family: TrashedFamily) {
    const typed = window.prompt(t.admin.trash.confirmPurge(family.name, family.memberCount));
    if (typed === null) return;
    if (!confirmsName(typed, family.name)) return setError(t.admin.trash.nameMismatch(family.name));
    void act(family.id, () => purgeTrashedFamily(family.id), t.admin.trash.purgeFailed(family.name));
  }

  return (
    <div className="admin-tab">
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <section className="glass admin-card" aria-labelledby="admin-trees">
        <h2 id="admin-trees">{t.admin.trees.title}</h2>
        {families.failed && !trees && <LoadError text={t.admin.trees.failed} onRetry={families.reload} />}
        {!trees && !families.failed && <p className="admin-muted">{t.admin.loading}</p>}
        {trees?.length === 0 && <p className="admin-muted">{t.admin.trees.empty}</p>}
        {!!trees?.length && (
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">{t.admin.trees.name}</th>
                <th scope="col">{t.admin.trees.created}</th>
                <th scope="col">{t.admin.trees.roles}</th>
                <th scope="col">{t.admin.trees.persons}</th>
                <th scope="col">
                  <span className="admin-hidden">{t.admin.trees.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {trees.map((family) => (
                <tr key={family.id}>
                  <td>
                    <strong>{family.name}</strong>
                    {family.test && <span className="admin-badge">{t.admin.trees.test}</span>}
                    <span className="admin-muted">/{family.slug}</span>
                  </td>
                  <td>
                    {family.createdBy ?? t.admin.trees.unknown}
                    <span className="admin-muted">{date(family.createdAt)}</span>
                  </td>
                  <td>
                    {t.admin.trees.roleCounts(
                      family.memberships.developer,
                      family.memberships.editor,
                      family.memberships.visitor,
                    )}
                  </td>
                  <td>{t.admin.persons(family.memberCount)}</td>
                  <td className="admin-actions">
                    <Link className="family-card-button" href={pathOf(family)}>
                      {t.admin.trees.open}
                    </Link>
                    <button
                      type="button"
                      className="family-card-button family-card-danger"
                      disabled={busy === family.id}
                      onClick={() => moveToTrash(family)}
                    >
                      <TrashIcon />
                      {t.admin.trees.trash}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <Can permission="family.manage">
        <section className="glass admin-card" aria-labelledby="admin-trash">
          <h2 id="admin-trash">{t.admin.trash.title}</h2>
          <p className="admin-muted">{t.admin.trash.hint}</p>
          {trash.failed && !trash.data && <LoadError text={t.admin.trash.failed} onRetry={trash.reload} />}
          {!trash.data && !trash.failed && <p className="admin-muted">{t.admin.loading}</p>}
          {trash.data?.length === 0 && <p className="admin-muted">{t.admin.trash.empty}</p>}
          {!!trash.data?.length && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">{t.admin.trees.name}</th>
                  <th scope="col">{t.admin.trash.deleted}</th>
                  <th scope="col">{t.admin.trash.left}</th>
                  <th scope="col">
                    <span className="admin-hidden">{t.admin.trees.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {trash.data.map((family) => (
                  <tr key={family.id}>
                    <td>
                      <strong>{family.name}</strong>
                      <span className="admin-muted">{t.admin.persons(family.memberCount)}</span>
                    </td>
                    <td>
                      {family.deletedBy ?? t.admin.trees.unknown}
                      <span className="admin-muted">{date(family.deletedAt)}</span>
                    </td>
                    <td>{t.admin.trash.days(daysLeft(family.purgeAt, now))}</td>
                    <td className="admin-actions">
                      <button
                        type="button"
                        className="family-card-button"
                        disabled={busy === family.id}
                        onClick={() => restore(family)}
                      >
                        {t.admin.trash.restore}
                      </button>
                      <button
                        type="button"
                        className="family-card-button family-card-danger"
                        disabled={busy === family.id}
                        onClick={() => purge(family)}
                      >
                        <TrashIcon />
                        {t.admin.trash.purge}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </Can>
    </div>
  );
}

// Without `family.manage` the trash is not shown, so nothing is asked for.
const noTrash = async () => ({ status: 200, data: [] });
