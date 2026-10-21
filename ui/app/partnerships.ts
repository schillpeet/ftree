// Rules for the dates of a partnership, pure so `partnerships.check.mjs` can test them.
import type { Partnership } from '../lib/api/generated/members';

type Dates = Pick<Partnership, 'status' | 'since' | 'marriedOn' | 'endedOn'>;

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
