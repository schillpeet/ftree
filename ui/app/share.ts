// Pure, so `share.check.mjs` can test it; the dialog lives in ShareDialog.tsx.
import type { TreeAccessEntry, TreeRole } from '../lib/api/generated/members';

// Roles an invitation can give; ownership is handed over with the transfer.
export const INVITE_ROLES: readonly TreeRole[] = ['editor', 'visitor'];

export type ShareProblem = 'lastOwner' | 'invalid' | 'notFound' | 'forbidden' | 'seatsExhausted' | 'failed';

// What went wrong when sharing, changing, removing, or handing over, from the problem code of the answer (null without
// one). The BFF has no code of its own for the last owner: demoting or removing them answers `INVALID_REQUEST`.
export function shareProblem(code: string | null): ShareProblem {
  switch (code) {
    case 'INVALID_REQUEST':
      return 'lastOwner';
    case 'VALIDATION_FAILED':
      return 'invalid';
    case 'NOT_FOUND':
      return 'notFound';
    case 'FORBIDDEN':
      return 'forbidden';
    case 'SEATS_EXHAUSTED':
      return 'seatsExhausted';
    default:
      return 'failed';
  }
}

// A cheap check before asking the server: one `@`, something on both sides, a dot in the domain, no spaces.
export function plausibleEmail(value: string): boolean {
  const email = value.trim();
  return email.length <= 320 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

export const ownerCount = (entries: readonly TreeAccessEntry[]) => entries.filter((entry) => entry.role === 'owner').length;

// The only owner can neither be demoted nor removed.
export const isLastOwner = (entry: TreeAccessEntry, entries: readonly TreeAccessEntry[]) =>
  entry.role === 'owner' && ownerCount(entries) <= 1;

// The roles a row's menu offers: the current one, and the invitable ones. Owner appears only for an owner.
export function roleChoices(entry: TreeAccessEntry): TreeRole[] {
  return entry.role === 'owner' ? ['owner', ...INVITE_ROLES] : [...INVITE_ROLES];
}

// Ownership can be handed to anyone who is not an owner already.
export const canTransferTo = (entry: TreeAccessEntry) => entry.role !== 'owner';

// Whether the row is the signed-in person; emails compare case-insensitively.
export const isSelf = (entry: TreeAccessEntry, email: string | null | undefined) =>
  !!email && entry.email.toLowerCase() === email.toLowerCase();
