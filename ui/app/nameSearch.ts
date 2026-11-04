import type { Member } from '../lib/api/generated/members';

type Searchable = Pick<Member, 'id' | 'firstName' | 'lastName' | 'birthName'>;

// Lower case without accents, so "jose" finds "José" and "mueller" is not needed to find "Müller".
export const normalize = (text: string) =>
  text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase().trim();

const fullName = (member: Searchable) => [member.firstName, member.lastName].filter(Boolean).join(' ');

const words = (text: string | null | undefined) => normalize(text ?? '').split(/\s+/).filter(Boolean);

// The parts of a name, each double-barrelled one also by its pieces, so "lud" finds Müller-Lüdenscheidt.
const partsOf = (text: string | null | undefined) =>
  words(text).flatMap((word) => [word, ...word.split('-').filter((piece) => piece && piece !== word)]);

// How well a name part fits: the first given name best, then further given names (some people go by their second
// one), then the surname and birth name.
const FIRST = 0;
const GIVEN = 1;
const SURNAME = 2;

// Members whose name parts start with the query's words, each word on a part of its own. A single letter only looks at
// given names (unless there are none), so "m" finds Marie and Karl Michael rather than everybody called Maci; from two letters on surnames and
// birth names count too. Matches on the first given name come first, surnames last; ties keep the order of the list.
export function searchMembers<T extends Searchable>(members: T[], query: string, limit = 8): T[] {
  const queryWords = words(query);
  if (queryWords.length === 0) return [];
  const singleLetter = queryWords.length === 1 && queryWords[0].length === 1;
  const ranked: { member: T; score: number; index: number }[] = [];
  members.forEach((member, index) => {
    const given = partsOf(member.firstName);
    // Someone known only by their surname is still found by its first letter.
    const givenOnly = singleLetter && given.length > 0;
    const parts = [
      ...given.map((part, i) => ({ part, rank: i === 0 ? FIRST : GIVEN })),
      ...(givenOnly ? [] : [...partsOf(member.lastName), ...partsOf(member.birthName)].map((part) => ({ part, rank: SURNAME }))),
    ];
    // Each word takes the best part still free; parts are ordered by rank, so the first fit is the best.
    const used = new Set<number>();
    let score = 0;
    for (const word of queryWords) {
      const at = parts.findIndex(({ part }, i) => !used.has(i) && part.startsWith(word));
      if (at < 0) return;
      used.add(at);
      score += parts[at].rank;
    }
    ranked.push({ member, score, index });
  });
  ranked.sort((a, b) => a.score - b.score || a.index - b.index);
  return ranked.slice(0, limit).map((entry) => entry.member);
}

export const memberLabel = (member: Searchable) => fullName(member) || member.id;
