'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  getAdminFamilies,
  getAdminPresence,
  getAdminUsers,
  type AdminFamily,
  type AdminPresence,
  type AdminUser,
} from '../../lib/api/generated/members';
import { useLanguage, useT } from '../i18n';
import { ChevronIcon } from '../icons';
import { useMe } from '../Permissions';
import {
  INACTIVE_DAYS,
  inPeopleFilter,
  matchesSearch,
  onlineTrees,
  PEOPLE_FILTERS,
  personStatus,
  sortedPeople,
  type PeopleFilter,
  type PersonStatus,
} from './adminData';
import InvitePerson from './InvitePerson';
import { LoadError } from './OverviewTab';
import PersonDetail, { Avatar } from './PersonDetail';
import { useAdminLoad } from './useAdminLoad';

// Who is online changes by the minute; the people themselves only when an admin changes them, so only presence refreshes.
const REFRESH_MS = 15_000;

// Everybody as a card that says who they are and whether they are around, narrowed by a search and filter chips; the
// chosen person (`/admin/people/<id>`) opens beside the list, or instead of it on a phone.
export default function PeopleTab() {
  const t = useT();
  const [language] = useLanguage();
  const locale = language === 'de' ? 'de-DE' : 'en-GB';
  const me = useMe();
  const router = useRouter();
  const selectedId = useParams<{ id?: string[] }>().id?.[0] ?? null;
  const users = useAdminLoad<AdminUser[]>(getAdminUsers);
  const presence = useAdminLoad<AdminPresence[]>(getAdminPresence, REFRESH_MS);
  const families = useAdminLoad<AdminFamily[]>(getAdminFamilies);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PeopleFilter>('all');
  const [notice, setNotice] = useState<string | null>(null);
  // Inactivity is counted from when the page opened; a day passing while it stays open is not worth a re-render.
  const [now] = useState(() => Date.now());
  const people = users.data && sortedPeople(users.data);
  const online = presence.data ? onlineTrees(presence.data) : new Map<string, string[]>();
  const selected = people?.find((user) => user.id === selectedId) ?? null;
  const filtered = (chip: PeopleFilter) => people?.filter((user) => inPeopleFilter(user, chip, online.get(user.id), now)) ?? [];
  const shown = filtered(filter).filter((user) => matchesSearch(query, user.displayName, user.email));
  const dateTime = (value: string) => new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

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

  function deleted(name: string) {
    setNotice(t.admin.deletion.done(name));
    router.push('/admin/people');
    users.reload();
    families.reload();
  }

  return (
    <div className="admin-tab">
      <div className="admin-toolbar">
        <InvitePerson trees={families.data ?? []} onShared={users.reload} />
      </div>
      {notice && (
        <p className="admin-status" role="status">
          {notice}
        </p>
      )}
      <div className="admin-filters admin-search">
        <input
          className="admin-select"
          type="search"
          aria-label={t.admin.people.search}
          placeholder={t.admin.people.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="admin-chips" role="group" aria-label={t.admin.people.title}>
          {PEOPLE_FILTERS.map((chip) => (
            <button
              key={chip}
              type="button"
              className="admin-chip"
              aria-pressed={filter === chip}
              title={chip === 'inactive' ? t.admin.people.inactiveHint(INACTIVE_DAYS) : undefined}
              onClick={() => setFilter(chip)}
            >
              {t.admin.people.filters[chip]}
              {people && <span className="admin-chip-count">{filtered(chip).length}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="admin-split" data-selected={selected ? '' : undefined}>
        <section className="admin-list" aria-label={t.admin.people.title}>
          {users.failed && !people && <LoadError text={t.admin.people.failed} onRetry={users.reload} />}
          {!people && !users.failed && <p className="admin-muted">{t.admin.loading}</p>}
          {people?.length === 0 && <p className="admin-muted">{t.admin.people.empty}</p>}
          {!!people?.length && shown.length === 0 && <p className="admin-muted">{t.admin.people.noMatch}</p>}
          {shown.map((user) => {
            const status = personStatus(user, online.get(user.id));
            const owned = user.trees.filter((tree) => tree.role === 'owner').length;
            return (
              <Link
                key={user.id}
                href={`/admin/people/${user.id}`}
                className="glass admin-person-card"
                aria-current={user.id === selectedId ? 'page' : undefined}
              >
                <Avatar name={user.displayName} state={status.kind} />
                <span className="admin-person-text">
                  <strong>
                    {user.displayName}
                    {user.id === me?.id && <span className="admin-badge">{t.admin.people.you}</span>}
                  </strong>
                  <span className="admin-muted" data-online={status.kind === 'online' ? '' : undefined}>
                    {statusText(status)}
                  </span>
                  <span className="admin-person-badges">
                    {user.admin && <span className="admin-badge admin-badge-accent">{t.admin.people.admin}</span>}
                    {user.canCreateTrees && !user.admin && <span className="admin-badge">{t.admin.people.canCreate}</span>}
                    <span className="admin-badge">{t.admin.people.treeCount(user.trees.length)}</span>
                    {owned > 0 && <span className="admin-badge">{t.admin.people.ownerOf(owned)}</span>}
                  </span>
                </span>
                <ChevronIcon />
              </Link>
            );
          })}
        </section>
        <div className="admin-detail-column">
          {selected ? (
            <PersonDetail
              key={selected.id}
              user={selected}
              users={people ?? []}
              families={families.data}
              status={statusText(personStatus(selected, online.get(selected.id)))}
              state={personStatus(selected, online.get(selected.id)).kind}
              self={selected.id === me?.id}
              onChanged={users.reload}
              onDeleted={deleted}
            />
          ) : (
            people && <p className="glass admin-card admin-muted admin-pick">{t.admin.people.pick}</p>
          )}
        </div>
      </div>
    </div>
  );
}
