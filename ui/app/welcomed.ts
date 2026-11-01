// Whether the invitation card greets the user in a tree. The server keeps the invitation open until the user accepts
// (`invitationPending`); "Später" puts it aside for this visit only, so the card is back on the next one. Pure, so
// `welcomed.check.mjs` can test it without a browser.
import type { FamilySummary } from '../lib/api/generated/members';

export function needsWelcome(family: Pick<FamilySummary, 'id' | 'invitationPending'> | null, postponed: readonly string[]): boolean {
  if (!family?.invitationPending) return false;
  return !postponed.includes(family.id);
}
