import { splitName } from './names.ts';

// The name the "add yourself" form starts with: the display name the user set themselves, split like a typed search
// (the last word is the surname). Without one both stay empty, since the fallback display name is only the email's
// local part, which is no real name.
export function selfNameOf(me: { customName?: string | null } | null | undefined): { firstName: string; lastName: string } {
  return splitName(me?.customName ?? '');
}
