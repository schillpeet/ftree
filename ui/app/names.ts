// Names may be unknown (stored empty): show the known parts, or `unknown` when both are missing.
type Named = { firstName: string; lastName: string };

export const isNameless = (m: Named) => !m.firstName && !m.lastName;

export const nameOf = (m: Named, unknown: string) => [m.firstName, m.lastName].filter(Boolean).join(' ') || unknown;

export const initialsOf = (m: Named) => (m.firstName[0] ?? '') + (m.lastName[0] ?? '') || '?';
