// Rules for the dates of a partnership, pure so `partnerships.check.mjs` can test them.
import type { Partnership } from '../lib/api/generated/members';

type Dates = Pick<Partnership, 'status' | 'since' | 'marriedOn' | 'endedOn'>;
type Details = Dates & Pick<Partnership, 'partnerId'>;

// Today as yyyy-mm-dd in local time, the format of date inputs.
export function today(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// The dates each status keeps; the BFF drops the others.
export function keptDates({ status, since, marriedOn, endedOn }: Dates) {
  return {
    since: status === 'together' ? since ?? null : null,
    marriedOn: status === 'married' || status === 'divorced' || status === 'widowed' ? marriedOn ?? null : null,
    endedOn: status === 'separated' || status === 'divorced' || status === 'widowed' ? endedOn ?? null : null,
  };
}

// What is wrong with a partnership's dates: one lies in the future, or its end (a divorce or a death) comes
// before the wedding.
export function dateProblem(partnership: Dates, on = today()): 'futureDate' | 'divorceBeforeWedding' | null {
  const { since, marriedOn, endedOn } = keptDates(partnership);
  if ([since, marriedOn, endedOn].some((date) => date && date > on)) return 'futureDate';
  if (marriedOn && endedOn && endedOn < marriedOn) return 'divorceBeforeWedding';
  return null;
}

// Current partners first, married before together and then the newer start first; then former ones
// (widowed, divorced, separated), the latest end first, so the oldest relationship comes last. Undated
// ones follow the dated ones of their group, widowed before divorced before separated; ties keep their order.
const RANK: Record<Partnership['status'], number> = { married: 0, together: 1, widowed: 2, divorced: 3, separated: 4 };

export function sortPartners<T extends { id: string }>(partners: T[], partnerships: readonly Details[]) {
  const of = (id: string): Dates => partnerships.find((p) => p.partnerId === id) ?? { status: 'together' };
  const current = (status: Partnership['status']) => status === 'married' || status === 'together';
  const dateOf = (p: Dates) => (current(p.status) ? keptDates(p).marriedOn ?? keptDates(p).since : keptDates(p).endedOn) ?? '';
  return partners
    .map((partner, index) => ({ partner, index, details: of(partner.id) }))
    .sort((a, b) => {
      const [x, y] = [a.details, b.details];
      if (current(x.status) !== current(y.status)) return current(x.status) ? -1 : 1;
      if (current(x.status) && x.status !== y.status) return RANK[x.status] - RANK[y.status];
      const [dx, dy] = [dateOf(x), dateOf(y)];
      if (dx !== dy) return !dx ? 1 : !dy ? -1 : dy.localeCompare(dx);
      return RANK[x.status] - RANK[y.status] || a.index - b.index;
    })
    .map(({ partner }) => partner);
}
