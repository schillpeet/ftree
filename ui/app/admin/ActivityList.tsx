'use client';

import type { AuditEntry } from '../../lib/api/generated/members';
import { useLanguage, useT, type ActivityFacts } from '../i18n';
import { activityDays, auditDetails, dayKind } from './adminData';

// The log as a timeline: one heading per day, one sentence per entry or burst of content changes, with the raw facts
// folded below it. `names` maps an email to the name shown for it; anyone else is shown by the part before the `@`.
export default function ActivityList({ entries, names, now }: { entries: readonly AuditEntry[]; names: ReadonlyMap<string, string>; now: number }) {
  const t = useT();
  const [language] = useLanguage();
  const locale = language === 'de' ? 'de-DE' : 'en-GB';
  const time = (value: string) => new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const heading = (day: string) => {
    const kind = dayKind(day, now);
    if (kind === 'today') return t.admin.activity.today;
    if (kind === 'yesterday') return t.admin.activity.yesterday;
    return new Date(`${day}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };
  const nameOf = (email: string | undefined) => (email ? (names.get(email.toLowerCase()) ?? email.split('@')[0]) : t.admin.activity.somebody);

  function sentence(group: readonly AuditEntry[]) {
    const entry = group[0];
    const details = entry.details;
    const facts: ActivityFacts = {
      who: entry.actor ? nameOf(entry.actor) : t.admin.activity.system,
      person: nameOf(details.email ?? (entry.targetType === 'user' ? entry.targetId : undefined)),
      tree: entry.targetName ?? details.name ?? t.admin.trees.unknown,
      role: details.role ? (t.account.roles[details.role as keyof typeof t.account.roles] ?? details.role) : '',
      other: details.from ?? details.name ?? '',
      count: group.length,
    };
    const say = t.admin.activity.sentences[entry.action];
    return say ? say(facts) : `${facts.who}: ${t.admin.audit.actions[entry.action] ?? entry.action}`;
  }

  // The facts a sentence leaves out; for a burst, when each change happened and which fields it touched.
  function facts(group: readonly AuditEntry[]) {
    return group.flatMap((entry) =>
      auditDetails(entry.details)
        .filter(([key]) => !['name', 'memberId', 'from', 'into'].includes(key))
        .map(([key, value]) => (
          <li key={`${entry.id}-${key}`}>
            {group.length > 1 && <time dateTime={entry.at}>{time(entry.at)} · </time>}
            {key === 'fields' ? t.admin.activity.fields : (t.admin.audit.detailKeys[key] ?? key)}:{' '}
            {key === 'role'
              ? (t.account.roles[value as keyof typeof t.account.roles] ?? value)
              : key === 'fields'
                ? value.split(',').join(', ')
                : (t.admin.audit.detailValues[value] ?? value)}
          </li>
        )),
    );
  }

  return (
    <div className="admin-timeline">
      {activityDays(entries).map((day) => (
        <section key={day.day} aria-label={heading(day.day)}>
          <h3>{heading(day.day)}</h3>
          <ol>
            {day.groups.map((group) => {
              const shown = facts(group);
              return (
                <li key={group[0].id} data-category={group[0].category}>
                  <time dateTime={group[0].at}>{time(group[0].at)}</time>
                  <span className="admin-timeline-dot" aria-hidden="true" />
                  <div>
                    <span>{sentence(group)}</span>
                    {shown.length > 0 && (
                      <details>
                        <summary>{t.admin.activity.details}</summary>
                        <ul>{shown}</ul>
                      </details>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
