// What the small status chip of the public pages says: the signed-in name, or an invitation to sign in. Both lead to
// `/start`, which signs in or opens the last tree.
export type ChipMe = { displayName?: string | null; email?: string | null };

// The name to greet: the display name, else the email address, else nothing (then the chip reads "Your tree").
export function chipName(me: ChipMe | null): string | null {
  if (!me) return null;
  return me.displayName?.trim() || me.email?.trim() || null;
}
