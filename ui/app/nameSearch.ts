import type { Member } from '../lib/api/generated/members';

type Searchable = Pick<Member, 'id' | 'firstName' | 'lastName' | 'birthName'>;

// Lower case without accents, so "jose" finds "José" and "mueller" is not needed to find "Müller".
export const normalize = (text: string) =>
  text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase().trim();

const fullName = (member: Searchable) => [member.firstName, member.lastName].filter(Boolean).join(' ');

// Members whose name (or birth name) contains every word of the query; names that start with a
// query word come first. Ties keep the order of the list.
export function searchMembers<T extends Searchable>(members: T[], query: string, limit = 8): T[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const ranked: { member: T; score: number; index: number }[] = [];
  members.forEach((member, index) => {
    const name = normalize(fullName(member));
    const haystack = member.birthName ? `${name} ${normalize(member.birthName)}` : name;
    if (!words.every((word) => haystack.includes(word))) return;
    const parts = haystack.split(/\s+/);
    const score = words.reduce((sum, word) => sum + (parts.some((part) => part.startsWith(word)) ? 0 : 1), 0);
    ranked.push({ member, score, index });
  });
  ranked.sort((a, b) => a.score - b.score || a.index - b.index);
  return ranked.slice(0, limit).map((entry) => entry.member);
}

export const memberLabel = (member: Searchable) => fullName(member) || member.id;
