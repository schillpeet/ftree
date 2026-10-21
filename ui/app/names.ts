// Names may be unknown (stored empty): show the known parts, or `unknown` when both are missing.
type Named = { firstName: string; lastName: string };

export const isNameless = (m: Named) => !m.firstName && !m.lastName;

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
