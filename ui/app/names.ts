// Names may be unknown (stored empty): show the known parts, or `unknown` when both are missing.
type Named = { firstName: string; lastName: string };

export const isNameless = (m: Named) => !m.firstName && !m.lastName;

// A nameless person is a placeholder: someone unknown or not entered yet. Out of discretion they are never called
// "unknown"; they are shown by their place in the tree instead: a parent if anyone hangs below them, else a partner,
// else a child, else just a person.
export type PlaceholderRole = 'parent' | 'partner' | 'child' | 'person';
type Linked = { id: string; parentIds: string[]; partnerIds: string[] };

export function placeholderRole(m: Linked, members: Pick<Linked, 'parentIds'>[]): PlaceholderRole {
  if (members.some((other) => other.parentIds.includes(m.id))) return 'parent';
  if (m.partnerIds.length > 0) return 'partner';
  if (m.parentIds.length > 0) return 'child';
  return 'person';
}

// The name to show: the person's name, or for a placeholder their role, in the words of `roles`.
export const displayName = (m: Named & Linked, members: Pick<Linked, 'parentIds'>[], roles: Record<PlaceholderRole, string>) =>
  nameOf(m, roles[placeholderRole(m, members)]);

export const nameOf = (m: Named, unknown: string) => [m.firstName, m.lastName].filter(Boolean).join(' ') || unknown;

export const initialsOf = (m: Named) => (m.firstName[0] ?? '') + (m.lastName[0] ?? '') || '?';

// Display only: later given names shrink to initials ("Johanne Katrin" -> "Johanne K.") so labels stay narrow.
export const shortFirstName = (firstName: string) =>
  firstName
    .split(/\s+/)
    .filter(Boolean)
    .map((part, i) => (i === 0 ? part : `${[...part][0]}.`))
    .join(' ');

// A typed search as a new person's name: the last word is the surname, the words before it the first names.
export function splitName(query: string): Named {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return { firstName: words[0] ?? '', lastName: '' };
  return { firstName: words.slice(0, -1).join(' '), lastName: words.at(-1)! };
}

const yearOf = (value?: string | null) => value?.slice(0, 4) ?? '';

// "1935 – 2006", "1935" or "† 2006"; empty without any year.
export function lifeSpan(member: { birthDate?: string | null; deathDate?: string | null }) {
  const born = yearOf(member.birthDate);
  const died = yearOf(member.deathDate);
  if (born && died) return `${born} – ${died}`;
  return born || (died && `† ${died}`) || '';
}
