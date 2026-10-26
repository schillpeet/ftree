// Pure helpers of the admin page, so `adminData.check.mjs` can test them without Next.
import type { AdminPresence } from '../../lib/api/generated/members';

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
