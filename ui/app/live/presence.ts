import type { PresentClient } from '../../lib/api/generated/members';

// A tab counts as idle while it is hidden or nobody has touched it for five minutes.
export const IDLE_AFTER_MS = 5 * 60_000;
// The BFF drops a tab after 60 s without presence and asks for one at least every 30 s.
export const HEARTBEAT_MS = 25_000;
// Waits before reopening a stream the browser gave up on, growing with each failure.
export const RECONNECT_MS = [1_000, 2_000, 5_000, 10_000, 30_000];
// Avatars shown before the rest collapse into "+n".
export const MAX_AVATARS = 6;

export function isIdle(hidden: boolean, lastActivity: number, now: number): boolean {
  return hidden || now - lastActivity >= IDLE_AFTER_MS;
}

export const reconnectDelay = (failures: number) => RECONNECT_MS[Math.min(failures, RECONNECT_MS.length - 1)];

// One person in the tree, however many tabs they have open there.
export type PresentPerson = {
  email: string;
  initials: string;
  admin: boolean;
  me: boolean;
  // Only when every tab is idle.
  idle: boolean;
  viewing: string | null;
  editing: string | null;
};

export type PresenceState = 'editing' | 'viewing' | 'idle' | 'here';

// Merges a user's tabs (an active tab's member wins) and sorts: me first, then active people, then idle ones, each by email.
export function peopleOf(present: readonly PresentClient[], myEmail: string | null | undefined): PresentPerson[] {
  const byEmail = new Map<string, PresentClient[]>();
  for (const client of present) byEmail.set(client.email, [...(byEmail.get(client.email) ?? []), client]);
  const people = [...byEmail.values()].map((tabs): PresentPerson => {
    const active = tabs.filter((tab) => !tab.idle);
    const preferred = [...active, ...tabs];
    return {
      email: tabs[0].email,
      initials: tabs[0].initials,
      admin: tabs.some((tab) => tab.admin),
      me: !!myEmail && tabs[0].email.toLowerCase() === myEmail.toLowerCase(),
      idle: active.length === 0,
      viewing: preferred.find((tab) => tab.viewing)?.viewing ?? null,
      editing: preferred.find((tab) => tab.editing)?.editing ?? null,
    };
  });
  const rank = (person: PresentPerson) => (person.me ? 0 : person.idle ? 2 : 1);
  return people.sort((a, b) => rank(a) - rank(b) || a.email.localeCompare(b.email));
}

export function stateOf(person: PresentPerson): PresenceState {
  if (person.idle) return 'idle';
  if (person.editing) return 'editing';
  if (person.viewing) return 'viewing';
  return 'here';
}

// The `present` list of a `presence` event, or null for anything malformed.
export function parsePresence(data: string): PresentClient[] | null {
  try {
    const present = (JSON.parse(data) as { present?: unknown }).present;
    if (!Array.isArray(present)) return null;
    return present.filter(
      (client): client is PresentClient =>
        !!client && typeof client.clientId === 'string' && typeof client.email === 'string' && typeof client.initials === 'string',
    );
  } catch {
    return null;
  }
}
