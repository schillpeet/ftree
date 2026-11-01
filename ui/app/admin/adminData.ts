// Pure helpers of the admin page, so `adminData.check.mjs` can test them without Next.
import type { AdminFamily, AdminPresence, AdminUser, AuditEntry, TreeRole } from '../../lib/api/generated/members';

const DAY = 24 * 60 * 60 * 1000;

// Whole days until the BFF removes a trashed family; the last, partial day counts as one, a passed date as none.
export function daysLeft(purgeAt: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(purgeAt) - now) / DAY));
}

// Bytes in the largest unit that keeps the number at or above 1, with at most one decimal.
export function formatBytes(bytes: number, locale: string): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString(locale, { maximumFractionDigits: unit === 0 ? 0 : 1 })} ${units[unit]}`;
}

// Purging needs the exact tree name typed; surrounding spaces do not matter.
export const confirmsName = (typed: string | null | undefined, name: string) => typed?.trim() === name;

export type PresenceRow = Pick<AdminPresence, 'email' | 'displayName' | 'admin' | 'familySlug' | 'familyName' | 'since'> & {
  idle: boolean;
  editing: boolean;
};

// One row per person and tree however many tabs they have open there: since the earliest tab arrived, idle only
// when every tab is, editing when any tab edits. The longest present first, then by name.
export function presenceRows(entries: readonly AdminPresence[]): PresenceRow[] {
  const rows = new Map<string, PresenceRow>();
  for (const entry of entries) {
    const key = `${entry.email}\n${entry.familyId}`;
    const row = rows.get(key);
    if (!row) {
      rows.set(key, {
        email: entry.email,
        displayName: entry.displayName,
        admin: entry.admin,
        familySlug: entry.familySlug,
        familyName: entry.familyName,
        since: entry.since,
        idle: entry.idle,
        editing: entry.editing !== null,
      });
      continue;
    }
    if (Date.parse(entry.since) < Date.parse(row.since)) row.since = entry.since;
    row.idle &&= entry.idle;
    row.editing ||= entry.editing !== null;
  }
  return [...rows.values()].sort(
    (a, b) => Date.parse(a.since) - Date.parse(b.since) || a.displayName.localeCompare(b.displayName),
  );
}

// The facts of an audit entry as key and value pairs in a fixed order, the usual ones first; none for an empty object.
const DETAIL_ORDER = ['email', 'role', 'name', 'reason', 'source'];
export function auditDetails(details: Record<string, string>): [string, string][] {
  const rank = (key: string) => (DETAIL_ORDER.includes(key) ? DETAIL_ORDER.indexOf(key) : DETAIL_ORDER.length);
  return Object.entries(details).sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}

// Which trees each person has a tab open in right now, by user id; people without a `users` row have none.
export function onlineTrees(entries: readonly AdminPresence[]): Map<string, string[]> {
  const trees = new Map<string, string[]>();
  for (const entry of entries) {
    if (!entry.userId) continue;
    const names = trees.get(entry.userId) ?? [];
    if (!names.includes(entry.familyName)) names.push(entry.familyName);
    trees.set(entry.userId, names);
  }
  return trees;
}

export type PersonStatus =
  | { kind: 'online'; trees: string[] }
  | { kind: 'seen'; at: string }
  | { kind: 'invited'; at: string | null }
  | { kind: 'never' };

// Online beats everything; else the last sign-in; else invited (named, never signed in) or, when somebody was added
// without an invitation, simply never signed in.
export function personStatus(user: Pick<AdminUser, 'status' | 'lastSeen' | 'invitedAt'>, online: readonly string[] | undefined): PersonStatus {
  if (online?.length) return { kind: 'online', trees: [...online] };
  if (user.lastSeen) return { kind: 'seen', at: user.lastSeen };
  if (user.status === 'invited') return { kind: 'invited', at: user.invitedAt };
  return { kind: 'never' };
}

// By display name, then by email, so two people with the same name keep a stable order.
export function sortedPeople<T extends Pick<AdminUser, 'displayName' | 'email'>>(users: readonly T[]): T[] {
  return [...users].sort((a, b) => a.displayName.localeCompare(b.displayName) || a.email.localeCompare(b.email));
}

export type AccessProblem = 'lastOwner' | 'notFound' | 'invalid' | 'forbidden' | 'unavailable' | 'ownsTrees' | 'cannotDelete' | 'seatsExhausted' | 'failed';

// What went wrong when sharing or removing, from the problem code of the answer (null without one). The BFF has no
// code of its own for the last owner: demoting or removing them answers `INVALID_REQUEST`, and nothing else in these
// calls can be invalid in that way, since the email is checked by `VALIDATION_FAILED`.
export function accessProblem(code: string | null): AccessProblem {
  switch (code) {
    case 'INVALID_REQUEST':
      return 'lastOwner';
    case 'VALIDATION_FAILED':
      return 'invalid';
    case 'NOT_FOUND':
      return 'notFound';
    case 'FORBIDDEN':
      return 'forbidden';
    case 'ACCESS_UNAVAILABLE':
      return 'unavailable';
    case 'SEATS_EXHAUSTED':
      return 'seatsExhausted';
    default:
      return 'failed';
  }
}

// Deleting a person: `INVALID_REQUEST` means the caller or an admin of the access file, not a last owner, and the
// BFF names the trees that need a new owner first with `USER_OWNS_TREES`.
export function deleteProblem(code: string | null): AccessProblem {
  if (code === 'INVALID_REQUEST') return 'cannotDelete';
  if (code === 'USER_OWNS_TREES') return 'ownsTrees';
  return accessProblem(code);
}

// The trees only this person owns, which need a new owner before they can be deleted. A tree missing from the
// families counts as theirs, since leaving it out would only make the BFF refuse later.
export function soleOwnedTrees(user: Pick<AdminUser, 'trees'>, families: readonly Pick<AdminFamily, 'id' | 'memberships'>[]) {
  return user.trees.filter((tree) => {
    if (tree.role !== 'owner') return false;
    const family = families.find((candidate) => candidate.id === tree.familyId);
    return !family || family.memberships.owner <= 1;
  });
}

export type OwnerCandidate = { id: string; displayName: string; role: TreeRole };

// Who could own the tree instead of the person: everyone else with a role in it, editors before visitors, then by name.
export function ownerCandidates(users: readonly AdminUser[], userId: string, familyId: string): OwnerCandidate[] {
  const rank = (role: TreeRole) => ['owner', 'editor', 'visitor'].indexOf(role);
  return users
    .filter((other) => other.id !== userId)
    .flatMap((other) => {
      const tree = other.trees.find((candidate) => candidate.familyId === familyId);
      return tree ? [{ id: other.id, displayName: other.displayName, role: tree.role }] : [];
    })
    .sort((a, b) => rank(a.role) - rank(b.role) || a.displayName.localeCompare(b.displayName));
}

// Deleting a person needs their name or their email typed; case and surrounding spaces do not matter for the email.
export function confirmsPerson(typed: string | null | undefined, user: Pick<AdminUser, 'displayName' | 'email'>): boolean {
  const value = typed?.trim();
  return !!value && (value === user.displayName || value.toLowerCase() === user.email.toLowerCase());
}

// Up to two letters for an avatar: the first letters of the first two words, else the first two of the only one.
export function initialsOf(name: string): string {
  const words = name.trim().split(/[\s._@-]+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length === 1 ? [...words[0]].slice(0, 2) : [[...words[0]][0], [...words[1]][0]];
  return letters.join('').toUpperCase();
}

export const PEOPLE_FILTERS = ['all', 'online', 'invited', 'inactive', 'admins', 'devTools'] as const;
export type PeopleFilter = (typeof PEOPLE_FILTERS)[number];

// Someone counts as inactive once their last sign-in lies this long back; people who never signed in do not.
export const INACTIVE_DAYS = 90;

// Whether a person belongs under a filter chip: online with a tab open, invited and never signed in, inactive for
// `INACTIVE_DAYS` while not online, an admin of any kind, or holding the developer tools (admins always do).
export function inPeopleFilter(
  user: Pick<AdminUser, 'admin' | 'canCreateTrees' | 'status' | 'lastSeen'>,
  filter: PeopleFilter,
  online: readonly string[] | undefined,
  now: number,
): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'online':
      return !!online?.length;
    case 'invited':
      return user.status === 'invited' && !user.lastSeen;
    case 'inactive':
      return !online?.length && !!user.lastSeen && now - Date.parse(user.lastSeen) >= INACTIVE_DAYS * DAY;
    case 'admins':
      return user.admin;
    case 'devTools':
      return user.admin || user.canCreateTrees;
  }
}

// A search matches the name or the email, ignoring case, accents, and surrounding spaces; an empty one matches everybody.
export function matchesSearch(query: string, ...fields: readonly (string | null | undefined)[]): boolean {
  const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const wanted = fold(query.trim());
  return !wanted || fields.some((field) => !!field && fold(field).includes(wanted));
}

// Invitations still unanswered after this many days are marked as overdue.
export const OVERDUE_DAYS = 14;

// Whole days since an invitation; one sent today is 0 days old.
export const daysSince = (at: string, now: number) => Math.max(0, Math.floor((now - Date.parse(at)) / DAY));

export const isOverdue = (invitedAt: string, now: number) => daysSince(invitedAt, now) >= OVERDUE_DAYS;

export type TreeKind = 'real' | 'test' | 'all';

// Whether a tree is listed: by kind (real trees by default, test trees on demand) and by name or slug.
export const treeListed = (family: Pick<AdminFamily, 'name' | 'slug' | 'test'>, kind: TreeKind, query: string) =>
  (kind === 'all' || family.test === (kind === 'test')) && matchesSearch(query, family.name, family.slug);

// Days until the next tree leaves the trash for good, or null while it is empty.
export function nextPurgeIn(trash: readonly { purgeAt: string }[], now: number): number | null {
  if (trash.length === 0) return null;
  return Math.min(...trash.map((family) => daysLeft(family.purgeAt, now)));
}

// A local calendar day as `YYYY-MM-DD`, so entries can be grouped by the day they happened where the admin is.
export function localDay(at: string | number): string {
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Content changes in a row by the same person, of the same kind, in the same tree, at most this far apart, read as one.
export const BURST_MS = 30 * 60 * 1000;

export type ActivityDay = { day: string; groups: AuditEntry[][] };

// The log, newest first, as days and, within a day, groups: every entry alone, except that a burst of content entries
// (`BURST_MS`) becomes one group, so editing six persons reads as one line instead of six.
export function activityDays(entries: readonly AuditEntry[]): ActivityDay[] {
  const days: ActivityDay[] = [];
  for (const entry of entries) {
    const day = localDay(entry.at);
    let current = days.at(-1);
    if (current?.day !== day) {
      current = { day, groups: [] };
      days.push(current);
    }
    const group = current.groups.at(-1);
    const last = group?.at(-1);
    const joins =
      !!last &&
      entry.category === 'content' &&
      last.category === 'content' &&
      last.action === entry.action &&
      last.targetId === entry.targetId &&
      (last.actorId ?? last.actor) === (entry.actorId ?? entry.actor) &&
      Date.parse(last.at) - Date.parse(entry.at) <= BURST_MS;
    if (joins) group!.push(entry);
    else current.groups.push([entry]);
  }
  return days;
}

// Whether a day is today, yesterday, or further back, seen from `now`.
export function dayKind(day: string, now: number): 'today' | 'yesterday' | 'earlier' {
  if (day === localDay(now)) return 'today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return day === localDay(yesterday.getTime()) ? 'yesterday' : 'earlier';
}

export const PERIODS = ['7', '30', '365', 'all'] as const;
export type Period = (typeof PERIODS)[number];

// The `from` of a period of whole days back from `now`, or nothing for everything.
export const periodStart = (period: Period, now: number) =>
  period === 'all' ? undefined : new Date(now - Number(period) * 24 * 60 * 60 * 1000).toISOString();

// The loaded entries as CSV (RFC 4180: comma-separated, every field quoted, quotes doubled), one line per entry.
export function auditCsv(entries: readonly AuditEntry[]): string {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const head = ['at', 'category', 'actor', 'action', 'targetType', 'target', 'details'];
  const rows = entries.map((entry) => [
    entry.at,
    entry.category,
    entry.actor ?? '',
    entry.action,
    entry.targetType,
    entry.targetName ?? entry.targetId,
    auditDetails(entry.details)
      .map(([key, value]) => `${key}=${value}`)
      .join('; '),
  ]);
  return [head, ...rows].map((row) => row.map(quote).join(',')).join('\r\n') + '\r\n';
}
