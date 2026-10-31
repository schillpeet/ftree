'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { TrashIcon, TreeIcon, UserIcon } from '../icons';
import { Can, useCan } from '../Permissions';
import { pathOf } from '../slugRoute';
import ActionMenu from './ActionMenu';
import { confirmsName, daysLeft, nextPurgeIn, treeListed, type TreeKind } from './adminData';
import { LoadError } from './OverviewTab';
import TransferOwnership from './TransferOwnership';
import { useAdminLoad } from './useAdminLoad';

// Every tree as a card with who created it, its persons, and how many hold each role, real trees first and test trees
// on demand; "Öffnen" is its one visible action, the others wait in the "⋯" menu. Below, the trash folds away.
export default function TreesTab() {
  const t = useT();
  const [language] = useLanguage();
  const locale = language === 'de' ? 'de-DE' : 'en-GB';
  const mayManage = useCan('family.manage');
  const families = useAdminLoad<AdminFamily[]>(getAdminFamilies);
  const trash = useAdminLoad<TrashedFamily[]>(mayManage ? getTrash : noTrash);
  const trees = families.data;
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<TreeKind>('real');
  const shown = trees?.filter((family) => treeListed(family, kind, query)) ?? [];
  // The id of the tree an action runs for, so its buttons wait.
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transferring, setTransferring] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Days are counted from when the page opened; a day passing while it stays open is not worth a re-render.
  const [now] = useState(() => Date.now());
  const date = (value: string) => new Date(value).toLocaleDateString(locale, { dateStyle: 'medium' });

  // Runs one action on a tree, then reloads both lists, since a tree moves between them.
  async function act(id: string, run: () => Promise<{ status: number }>, failed: string) {
    setBusy(id);
    setError(null);
    setNotice(null);
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
      {notice && (
        <p className="admin-status" role="status">
          {notice}
        </p>
      )}
      <div className="admin-filters admin-search">
        <input
          className="admin-select"
          type="search"
          aria-label={t.admin.trees.search}
          placeholder={t.admin.trees.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="admin-select admin-role"
          aria-label={t.admin.trees.kind}
          value={kind}
          onChange={(event) => setKind(event.target.value as TreeKind)}
        >
          {(['real', 'test', 'all'] as const).map((option) => (
            <option key={option} value={option}>
              {t.admin.trees.kinds[option]}
            </option>
          ))}
        </select>
      </div>
      <section aria-labelledby="admin-trees">
        <h2 id="admin-trees" className="admin-hidden">
          {t.admin.trees.title}
        </h2>
        {families.failed && !trees && <LoadError text={t.admin.trees.failed} onRetry={families.reload} />}
        {!trees && !families.failed && <p className="admin-muted">{t.admin.loading}</p>}
        {trees?.length === 0 && <p className="admin-muted">{t.admin.trees.empty}</p>}
        {!!trees?.length && shown.length === 0 && <p className="admin-muted">{t.admin.trees.noMatch}</p>}
        <ul className="admin-tree-grid">
          {shown.map((family) => (
            <li key={family.id} className="glass admin-tree-card">
              <div className="admin-tree-head">
                <span className="admin-tree-icon" aria-hidden="true">
                  <TreeIcon />
                </span>
                <span className="admin-person-text">
                  <strong>
                    {family.name}
                    {family.test && <span className="admin-badge">{t.admin.trees.test}</span>}
                  </strong>
                  <span className="admin-muted">/{family.slug}</span>
                </span>
              </div>
              <span className="admin-muted">
                {t.admin.trees.createdBy(family.createdBy ?? t.admin.trees.unknown, date(family.createdAt))}
              </span>
              <span className="admin-tree-stats">
                <span>{t.admin.persons(family.memberCount)}</span>
                <span className="admin-muted">
                  {t.admin.trees.roleCounts(family.memberships.owner, family.memberships.editor, family.memberships.visitor)}
                </span>
              </span>
              {transferring === family.id ? (
                <TransferOwnership
                  familyId={family.id}
                  familyName={family.name}
                  onClose={() => setTransferring(null)}
                  onDone={(message) => {
                    setTransferring(null);
                    setNotice(message);
                    families.reload();
                  }}
                />
              ) : (
                <div className="admin-tree-actions">
                  <Link className="family-card-button" href={pathOf(family)}>
                    {t.admin.trees.open}
                  </Link>
                  <ActionMenu
                    label={t.admin.trees.more(family.name)}
                    disabled={busy === family.id}
                    actions={[
                      { label: t.admin.ownership.transfer, icon: <UserIcon />, onSelect: () => setTransferring(family.id) },
                      { label: t.admin.trees.auditOf, onSelect: () => router.push(`/admin/audit?tree=${family.id}`) },
                      { label: t.admin.trees.trash, icon: <TrashIcon />, danger: true, onSelect: () => moveToTrash(family) },
                    ]}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
      <Can permission="family.manage">
        <details className="glass admin-card admin-trash">
          <summary>
            <TrashIcon />
            <span id="admin-trash">{t.admin.trash.title}</span>
            {trash.data && (
              <span className="admin-muted">
                {trash.data.length === 0
                  ? t.admin.trash.empty
                  : `${t.admin.trash.summary(trash.data.length)} · ${t.admin.trash.nextPurge(nextPurgeIn(trash.data, now) ?? 0)}`}
              </span>
            )}
          </summary>
          <p className="admin-muted">{t.admin.trash.hint}</p>
          {trash.failed && !trash.data && <LoadError text={t.admin.trash.failed} onRetry={trash.reload} />}
          {!trash.data && !trash.failed && <p className="admin-muted">{t.admin.loading}</p>}
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
        </details>
      </Can>
    </div>
  );
}

// Without `family.manage` the trash is not shown, so nothing is asked for.
const noTrash = async () => ({ status: 200, data: [] });
