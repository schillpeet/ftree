'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import {
  getAdminAudit,
  getAdminAuditFilters,
  getAdminFamilies,
  type AdminFamily,
  type AuditCategory,
  type AuditEntry,
  type AuditFilters,
  type AuditPage,
} from '../../lib/api/generated/members';
import { useT } from '../i18n';
import { DownloadIcon } from '../icons';
import ActivityList from './ActivityList';
import { auditCsv, PERIODS, periodStart, type Period } from './adminData';
import { LoadError } from './OverviewTab';
import { useAdminLoad } from './useAdminLoad';

const PAGE_SIZE = 50;

const CATEGORIES = ['all', 'access', 'tree', 'content', 'admin', 'system'] as const;

type Query = { userId: string; familyId: string; category: AuditCategory | 'all'; period: Period };

// Who changed which rights, trees, or persons when, as a timeline narrowed by category, person, tree, and period;
// `?person=<user id>` and `?tree=<family id>` preset the filters, as the person and tree cards link here.
export default function AuditTab() {
  const t = useT();
  const params = useSearchParams();
  const filters = useAdminLoad<AuditFilters>(getAdminAuditFilters);
  const families = useAdminLoad<AdminFamily[]>(getAdminFamilies);
  const [query, setQuery] = useState<Query>(() => ({
    userId: params.get('person') ?? '',
    familyId: params.get('tree') ?? '',
    category: 'all',
    // A person's or tree's own log shows everything; the whole log starts with the last month.
    period: params.get('person') || params.get('tree') ? 'all' : '30',
  }));
  const set = (key: 'userId' | 'familyId' | 'period') => (event: React.ChangeEvent<HTMLSelectElement>) =>
    setQuery((current) => ({ ...current, [key]: event.target.value }));
  const names = new Map((filters.data?.people ?? []).flatMap((person) => (person.displayName ? [[person.email.toLowerCase(), person.displayName]] : [])));

  return (
    <div className="admin-tab">
      <section className="glass admin-card" aria-labelledby="admin-audit">
        <h2 id="admin-audit">{t.admin.activity.title}</h2>
        <p className="admin-muted">{t.admin.activity.hint}</p>
        <div className="admin-chips admin-categories" role="group" aria-label={t.admin.activity.title}>
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              className="admin-chip"
              data-category={category}
              aria-pressed={query.category === category}
              onClick={() => setQuery((current) => ({ ...current, category }))}
            >
              {t.admin.activity.categories[category]}
            </button>
          ))}
        </div>
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
            {t.admin.activity.period}
            <select className="admin-select" value={query.period} onChange={set('period')}>
              {PERIODS.map((period) => (
                <option key={period} value={period}>
                  {t.admin.activity.periods[period]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {/* A new filter starts a new list, so the list is keyed by it. */}
        <AuditList key={`${query.userId}|${query.familyId}|${query.category}|${query.period}`} query={query} names={names} />
        <p className="admin-muted admin-retention">{t.admin.activity.retention}</p>
      </section>
    </div>
  );
}

function AuditList({ query, names }: { query: Query; names: ReadonlyMap<string, string> }) {
  const t = useT();
  // The period counts back from when the filter was chosen, so loading more pages keeps the same window.
  const [now] = useState(() => Date.now());
  const loadFirst = useCallback(() => fetchPage(query, now), [query, now]);
  const first = useAdminLoad<AuditPage>(loadFirst);
  // Pages after the first; `next` is undefined until one was loaded, then the cursor after the last page.
  const [more, setMore] = useState<{ entries: AuditEntry[]; next: number | null } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const next = more ? more.next : (first.data?.next ?? null);
  const entries = first.data ? [...first.data.entries, ...(more?.entries ?? [])] : null;

  async function loadMore() {
    if (next === null || !first.data) return;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const response = await fetchPage(query, now, next);
      if (response.status !== 200) throw new Error('failed');
      const page = response.data as AuditPage;
      setMore({ entries: [...(more?.entries ?? []), ...page.entries], next: page.next });
    } catch {
      setMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  // The loaded entries as a file; nothing leaves the browser.
  function exportCsv() {
    if (!entries) return;
    const url = URL.createObjectURL(new Blob([auditCsv(entries)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ftree-activity-${new Date(now).toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (first.failed && !entries) return <LoadError text={t.admin.audit.failed} onRetry={first.reload} />;
  if (!entries) return <p className="admin-muted">{t.admin.loading}</p>;
  if (entries.length === 0) return <p className="admin-muted">{t.admin.audit.empty}</p>;
  return (
    <>
      <div className="admin-toolbar">
        <button type="button" className="family-card-button" onClick={exportCsv}>
          <DownloadIcon />
          {t.admin.activity.csv}
        </button>
      </div>
      <ActivityList entries={entries} names={names} now={now} />
      {moreFailed && <LoadError text={t.admin.audit.moreFailed} onRetry={() => void loadMore()} />}
      {next !== null && !moreFailed && (
        <button type="button" className="family-card-button admin-more" disabled={loadingMore} onClick={() => void loadMore()}>
          {loadingMore ? t.admin.loading : t.admin.audit.more}
        </button>
      )}
    </>
  );
}

const fetchPage = (query: Query, now: number, before?: number) =>
  getAdminAudit({
    limit: PAGE_SIZE,
    before,
    userId: query.userId || undefined,
    familyId: query.familyId || undefined,
    category: query.category === 'all' ? undefined : query.category,
    from: periodStart(query.period, now),
  });
