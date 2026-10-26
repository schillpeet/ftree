'use client';

import { useCallback, useState } from 'react';
import {
  getAdminAudit,
  getAdminAuditFilters,
  getAdminFamilies,
  type AdminFamily,
  type AuditEntry,
  type AuditFilters,
  type AuditPage,
} from '../../lib/api/generated/members';
import { useLanguage, useT } from '../i18n';
import { auditDetails } from './adminData';
import { LoadError } from './OverviewTab';
import { useAdminLoad } from './useAdminLoad';

const PAGE_SIZE = 50;

type Query = { userId: string; familyId: string; action: string };

// Who changed which rights or trees when, newest first, narrowed by person, tree, and action.
export default function AuditTab() {
  const t = useT();
  const filters = useAdminLoad<AuditFilters>(getAdminAuditFilters);
  const families = useAdminLoad<AdminFamily[]>(getAdminFamilies);
  const [query, setQuery] = useState<Query>({ userId: '', familyId: '', action: '' });
  const set = (key: keyof Query) => (event: React.ChangeEvent<HTMLSelectElement>) =>
    setQuery((current) => ({ ...current, [key]: event.target.value }));

  return (
    <div className="admin-tab">
      <section className="glass admin-card" aria-labelledby="admin-audit">
        <h2 id="admin-audit">{t.admin.audit.title}</h2>
        <p className="admin-muted">{t.admin.audit.hint}</p>
        <div className="admin-filters">
          <label>
            {t.admin.audit.person}
            <select className="admin-select" value={query.userId} onChange={set('userId')}>
              <option value="">{t.admin.audit.all}</option>
              {filters.data?.people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.displayName ? `${person.displayName} (${person.email})` : person.email}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.admin.audit.tree}
            <select className="admin-select" value={query.familyId} onChange={set('familyId')}>
              <option value="">{t.admin.audit.all}</option>
              {families.data?.map((family) => (
                <option key={family.id} value={family.id}>
                  {family.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.admin.audit.action}
            <select className="admin-select" value={query.action} onChange={set('action')}>
              <option value="">{t.admin.audit.all}</option>
              {filters.data?.actions.map((action) => (
                <option key={action} value={action}>
                  {t.admin.audit.actions[action] ?? action}
                </option>
              ))}
            </select>
          </label>
        </div>
        {/* A new filter starts a new list, so the list is keyed by it. */}
        <AuditList key={`${query.userId}|${query.familyId}|${query.action}`} query={query} />
      </section>
    </div>
  );
}

function AuditList({ query }: { query: Query }) {
  const t = useT();
  const [language] = useLanguage();
  const locale = language === 'de' ? 'de-DE' : 'en-GB';
  const loadFirst = useCallback(() => fetchPage(query), [query]);
  const first = useAdminLoad<AuditPage>(loadFirst);
  // Pages after the first; `next` is undefined until one was loaded, then the cursor after the last page.
  const [more, setMore] = useState<{ entries: AuditEntry[]; next: number | null } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const next = more ? more.next : (first.data?.next ?? null);
  const entries = first.data ? [...first.data.entries, ...(more?.entries ?? [])] : null;
  const time = (value: string) => new Date(value).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'medium' });

  async function loadMore() {
    if (next === null || !first.data) return;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const response = await fetchPage(query, next);
      if (response.status !== 200) throw new Error('failed');
      const page = response.data as AuditPage;
      setMore({ entries: [...(more?.entries ?? []), ...page.entries], next: page.next });
    } catch {
      setMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  if (first.failed && !entries) return <LoadError text={t.admin.audit.failed} onRetry={first.reload} />;
  if (!entries) return <p className="admin-muted">{t.admin.loading}</p>;
  if (entries.length === 0) return <p className="admin-muted">{t.admin.audit.empty}</p>;
  return (
    <>
      <table className="admin-table">
        <thead>
          <tr>
            <th scope="col">{t.admin.audit.time}</th>
            <th scope="col">{t.admin.audit.who}</th>
            <th scope="col">{t.admin.audit.action}</th>
            <th scope="col">{t.admin.audit.target}</th>
            <th scope="col">{t.admin.audit.details}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>{time(entry.at)}</td>
              <td>{entry.actor ?? <span className="admin-muted">{t.admin.audit.system}</span>}</td>
              <td>{t.admin.audit.actions[entry.action] ?? entry.action}</td>
              <td>{target(entry, t.admin.trees.unknown)}</td>
              <td>
                {/* A tree's name is already the target. */}
                {auditDetails(entry.details).filter(([key]) => !(key === 'name' && entry.targetType === 'family')).map(([key, value]) => (
                  <span key={key} className="admin-muted">
                    {t.admin.audit.detailKeys[key] ?? key}: {key === 'role' ? (t.account.roles[value as keyof typeof t.account.roles] ?? value) : (t.admin.audit.detailValues[value] ?? value)}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {moreFailed && <LoadError text={t.admin.audit.moreFailed} onRetry={() => void loadMore()} />}
      {next !== null && !moreFailed && (
        <button type="button" className="family-card-button admin-more" disabled={loadingMore} onClick={() => void loadMore()}>
          {loadingMore ? t.admin.loading : t.admin.audit.more}
        </button>
      )}
    </>
  );
}

const fetchPage = (query: Query, before?: number) =>
  getAdminAudit({
    limit: PAGE_SIZE,
    before,
    userId: query.userId || undefined,
    familyId: query.familyId || undefined,
    action: query.action || undefined,
  });

// A tree by its name, a person by their email, anything else (the system's own steps) by nothing.
function target(entry: AuditEntry, unknown: string) {
  if (entry.targetType === 'family') return entry.targetName ?? unknown;
  return entry.targetType === 'user' ? entry.targetId : '–';
}
