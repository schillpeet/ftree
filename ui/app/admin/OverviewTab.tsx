'use client';

import Link from 'next/link';
import { getAdminOverview, getAdminPresence, type AdminOverview, type AdminPresence } from '../../lib/api/generated/members';
import { useLanguage, useT } from '../i18n';
import { formatBytes, presenceRows } from './adminData';
import { useAdminLoad } from './useAdminLoad';

// Who is online changes by the minute, so the totals and the list refresh on their own.
const REFRESH_MS = 15_000;

// Totals across every tree, then who is in which tree right now.
export default function OverviewTab() {
  const t = useT();
  const [language] = useLanguage();
  const locale = language === 'de' ? 'de-DE' : 'en-GB';
  const overview = useAdminLoad<AdminOverview>(getAdminOverview, REFRESH_MS);
  const presence = useAdminLoad<AdminPresence[]>(getAdminPresence, REFRESH_MS);
  const rows = presence.data ? presenceRows(presence.data) : null;
  const number = (value: number) => value.toLocaleString(locale);
  const time = (value: string) => new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  const totals = overview.data;
  const tiles = totals && [
    { label: t.admin.overview.online, value: number(totals.online) },
    {
      label: t.admin.overview.seats,
      value: `${number(totals.seats.used)} / ${number(totals.seats.limit)}`,
      hint: t.admin.overview.users(totals.users.signedIn, totals.users.invited),
    },
    { label: t.admin.overview.trees, value: number(totals.families) },
    { label: t.admin.overview.persons, value: number(totals.members) },
    {
      label: t.admin.overview.photos,
      value: number(totals.photos.count),
      hint: t.admin.overview.storage(formatBytes(totals.photos.bytes, locale)),
    },
  ];

  return (
    <div className="admin-tab">
      {overview.failed && !totals && <LoadError text={t.admin.overview.failed} onRetry={overview.reload} />}
      {!totals && !overview.failed && <p className="admin-muted">{t.admin.loading}</p>}
      {tiles && (
        <ul className="admin-tiles">
          {tiles.map((tile) => (
            <li key={tile.label} className="glass admin-tile">
              <span className="admin-tile-label">{tile.label}</span>
              <strong className="admin-tile-value">{tile.value}</strong>
              {tile.hint && <span className="admin-muted">{tile.hint}</span>}
            </li>
          ))}
        </ul>
      )}
      <section className="glass admin-card" aria-labelledby="admin-active">
        <h2 id="admin-active">{t.admin.overview.active}</h2>
        {presence.failed && !rows && <LoadError text={t.admin.overview.activeFailed} onRetry={presence.reload} />}
        {!rows && !presence.failed && <p className="admin-muted">{t.admin.loading}</p>}
        {rows?.length === 0 && <p className="admin-muted">{t.admin.overview.nobody}</p>}
        {!!rows?.length && (
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">{t.admin.overview.who}</th>
                <th scope="col">{t.admin.overview.tree}</th>
                <th scope="col">{t.admin.overview.since}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.email}-${row.familySlug}`} data-idle={row.idle ? '' : undefined}>
                  <td>
                    <strong>{row.displayName}</strong>
                    {row.admin && <span className="admin-badge">{t.account.roles.admin}</span>}
                    <span className="admin-muted admin-email">{row.email}</span>
                  </td>
                  <td>
                    <Link href={`/${row.familySlug}`}>{row.familyName}</Link>
                    {row.editing && <span className="admin-badge admin-badge-accent">{t.admin.overview.editing}</span>}
                    {row.idle && <span className="admin-badge">{t.admin.overview.idle}</span>}
                  </td>
                  <td>{time(row.since)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export function LoadError({ text, onRetry }: { text: string; onRetry: () => void }) {
  const t = useT();
  return (
    <div className="admin-error" role="alert">
      <p>{text}</p>
      <button type="button" className="family-card-button" onClick={onRetry}>
        {t.retry}
      </button>
    </div>
  );
}
