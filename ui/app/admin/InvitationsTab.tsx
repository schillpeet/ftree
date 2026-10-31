'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  getAdminFamilies,
  getAdminInvitations,
  type AdminFamily,
  type AdminInvitation,
} from '../../lib/api/generated/members';
import { useLanguage, useT } from '../i18n';
import { copyText, revoke, share } from './accessActions';
import { daysSince, isOverdue } from './adminData';
import InvitePerson from './InvitePerson';
import { LoadError } from './OverviewTab';
import { useAdminLoad } from './useAdminLoad';

// People who never signed in, one row per tree they were invited to, with the text to send them again or to withdraw it;
// invitations unanswered for two weeks are marked as overdue.
export default function InvitationsTab() {
  const t = useT();
  const [language] = useLanguage();
  const locale = language === 'de' ? 'de-DE' : 'en-GB';
  const invitations = useAdminLoad<AdminInvitation[]>(getAdminInvitations);
  const families = useAdminLoad<AdminFamily[]>(getAdminFamilies);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const rows = invitations.data;
  const date = (value: string) => new Date(value).toLocaleDateString(locale, { dateStyle: 'medium' });
  const keyOf = (row: AdminInvitation) => `${row.userId}/${row.familyId}`;
  // Ages are counted from when the page opened; a day passing while it stays open is not worth a re-render.
  const [now] = useState(() => Date.now());

  async function copy(row: AdminInvitation) {
    setBusy(keyOf(row));
    setMessage(null);
    const result = await share(row.familyId, row.email, row.role, language);
    const copied = result.ok && (await copyText(result.data.text));
    setMessage(
      result.ok
        ? { text: copied ? t.admin.invitations.copied(row.displayName) : t.admin.invite.copyFailed, ok: copied }
        : { text: t.admin.problems[result.problem], ok: false },
    );
    setBusy(null);
  }

  async function withdraw(row: AdminInvitation) {
    if (!window.confirm(t.admin.invitations.confirmWithdraw(row.displayName, row.familyName))) return;
    setBusy(keyOf(row));
    setMessage(null);
    const result = await revoke(row.familyId, row.userId);
    if (!result.ok) setMessage({ text: t.admin.problems[result.problem], ok: false });
    setBusy(null);
    invitations.reload();
  }

  return (
    <div className="admin-tab">
      <div className="admin-toolbar">
        <InvitePerson trees={families.data ?? []} onShared={invitations.reload} />
      </div>
      {message && (
        <p className={message.ok ? 'admin-muted' : 'admin-error'} role={message.ok ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}
      <section className="glass admin-card" aria-labelledby="admin-invitations">
        <h2 id="admin-invitations">{t.admin.invitations.title}</h2>
        <p className="admin-muted">{t.admin.invitations.hint}</p>
        {invitations.failed && !rows && <LoadError text={t.admin.invitations.failed} onRetry={invitations.reload} />}
        {!rows && !invitations.failed && <p className="admin-muted">{t.admin.loading}</p>}
        {rows?.length === 0 && <p className="admin-muted">{t.admin.invitations.empty}</p>}
        {!!rows?.length && (
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">{t.admin.people.person}</th>
                <th scope="col">{t.admin.invitations.tree}</th>
                <th scope="col">{t.admin.invitations.invited}</th>
                <th scope="col">
                  <span className="admin-hidden">{t.admin.trees.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={keyOf(row)}>
                  <td>
                    <strong>{row.displayName}</strong>
                    <span className="admin-muted admin-email">{row.email}</span>
                  </td>
                  <td>
                    <Link href={`/${row.familySlug}`}>{row.familyName}</Link>
                    <span className="admin-muted">{t.account.roles[row.role]}</span>
                  </td>
                  <td>
                    {row.invitedBy ?? t.admin.invitations.byServer}
                    <span className="admin-muted">
                      {date(row.invitedAt)} · {t.admin.invitations.age(daysSince(row.invitedAt, now))}
                      {isOverdue(row.invitedAt, now) && <span className="admin-badge admin-badge-warning">{t.admin.invitations.overdue}</span>}
                    </span>
                  </td>
                  <td className="admin-actions">
                    <button type="button" className="family-card-button" disabled={busy === keyOf(row)} onClick={() => void copy(row)}>
                      {t.admin.invitations.copy}
                    </button>
                    <button
                      type="button"
                      className="family-card-button family-card-danger"
                      disabled={busy === keyOf(row)}
                      onClick={() => void withdraw(row)}
                    >
                      {t.admin.invitations.withdraw}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
