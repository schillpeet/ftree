// What the BFF's `member-changed`, `member-deleted`, and `family-changed` events mean for this tab. `resync` is not
// sent by the BFF: the stream reopened, so changes may have been missed.
export type LiveEvent =
  | { kind: 'member-changed' | 'member-deleted'; memberId: string; by: string }
  | { kind: 'family-changed'; familyId: string; by: string }
  | { kind: 'resync' };

const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';

// The event named `name` with its JSON `data`, or null for other events and anything malformed.
export function parseLiveEvent(name: string, data: string): LiveEvent | null {
  let body: { memberId?: unknown; familyId?: unknown; by?: unknown };
  try {
    body = JSON.parse(data) ?? {};
  } catch {
    return null;
  }
  if (!isText(body.by)) return null;
  if ((name === 'member-changed' || name === 'member-deleted') && isText(body.memberId)) {
    return { kind: name, memberId: body.memberId, by: body.by };
  }
  if (name === 'family-changed' && isText(body.familyId)) return { kind: 'family-changed', familyId: body.familyId, by: body.by };
  return null;
}

// Whether the signed-in user saved the change (in any of their tabs); a resync is nobody's.
export function isOwnEvent(event: LiveEvent, myEmail: string | null | undefined): boolean {
  return event.kind !== 'resync' && !!myEmail && event.by.toLowerCase() === myEmail.toLowerCase();
}

// A first name for a toast, from the email's local part: "manuel.meier@x" -> "Manuel". The address itself stays off screen.
export function whoOf(email: string): string {
  const first = email.split('@')[0].split(/[._+-]/).find(Boolean) ?? '';
  return first ? first[0].toUpperCase() + first.slice(1) : email;
}

export type LiveToast = {
  kind: 'member-changed' | 'member-deleted' | 'family-changed';
  who: string;
  // The person's name when the event was received; null for a family change.
  name: string | null;
  // Someone changed the person this user is editing, so saving will hit the conflict dialog.
  conflict: boolean;
};

// The toast for an event, or null when it needs none (own and resync events).
export function toastOf(
  event: LiveEvent,
  myEmail: string | null | undefined,
  nameOfMember: (id: string) => string,
  editingId: string | null,
): LiveToast | null {
  if (event.kind === 'resync' || isOwnEvent(event, myEmail)) return null;
  if (event.kind === 'family-changed') return { kind: event.kind, who: whoOf(event.by), name: null, conflict: false };
  return {
    kind: event.kind,
    who: whoOf(event.by),
    name: nameOfMember(event.memberId),
    conflict: event.memberId === editingId,
  };
}
