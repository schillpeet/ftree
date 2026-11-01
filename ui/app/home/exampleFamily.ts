// The read-only example family of the landing page: four generations, bundled with the UI so `/home/example` needs no
// sign-in and no BFF. Fixed ids keep the tree's layout the same on every visit. Pure, so `exampleFamily.check.mjs` can
// test it.
import type { Member, PartnershipStatus } from '../../lib/api/generated/members';

type Person = {
  id: string;
  firstName: string;
  lastName: string;
  birthName?: string;
  born: string;
  died?: string;
  parents?: string[];
  partner?: { id: string; status: PartnershipStatus };
};

const PEOPLE: Person[] = [
  { id: 'heinrich', firstName: 'Heinrich', lastName: 'Linde', born: '1931-03-14', died: '2009-11-02', partner: { id: 'margarete', status: 'married' } },
  { id: 'margarete', firstName: 'Margarete', lastName: 'Linde', birthName: 'Vogt', born: '1934-07-28', died: '2018-01-19', partner: { id: 'heinrich', status: 'married' } },
  { id: 'peter', firstName: 'Peter', lastName: 'Linde', born: '1958-05-09', parents: ['heinrich', 'margarete'], partner: { id: 'sabine', status: 'married' } },
  { id: 'sabine', firstName: 'Sabine', lastName: 'Linde', birthName: 'Brandt', born: '1961-09-30', partner: { id: 'peter', status: 'married' } },
  { id: 'ursula', firstName: 'Ursula', lastName: 'Hartmann', birthName: 'Linde', born: '1962-12-04', parents: ['heinrich', 'margarete'], partner: { id: 'thomas', status: 'married' } },
  { id: 'thomas', firstName: 'Thomas', lastName: 'Hartmann', born: '1960-02-17', partner: { id: 'ursula', status: 'married' } },
  { id: 'jonas', firstName: 'Jonas', lastName: 'Linde', born: '1988-04-21', parents: ['peter', 'sabine'], partner: { id: 'mira', status: 'married' } },
  { id: 'mira', firstName: 'Mira', lastName: 'Linde', birthName: 'Okafor', born: '1990-08-11', partner: { id: 'jonas', status: 'married' } },
  { id: 'lea', firstName: 'Lea', lastName: 'Linde', born: '1992-06-03', parents: ['peter', 'sabine'] },
  { id: 'clara', firstName: 'Clara', lastName: 'Hartmann', born: '1994-10-15', parents: ['ursula', 'thomas'] },
  { id: 'emil', firstName: 'Emil', lastName: 'Linde', born: '2019-02-26', parents: ['jonas', 'mira'] },
  { id: 'ida', firstName: 'Ida', lastName: 'Linde', born: '2022-07-08', parents: ['jonas', 'mira'] },
];

export const EXAMPLE_MEMBERS: Member[] = PEOPLE.map((person) => ({
  id: `example-${person.id}`,
  version: 0,
  firstName: person.firstName,
  lastName: person.lastName,
  birthName: person.birthName ?? null,
  birthDate: person.born,
  deathDate: person.died ?? null,
  parentIds: (person.parents ?? []).map((id) => `example-${id}`),
  parentLinks: (person.parents ?? []).map((id) => ({ parentId: `example-${id}`, kind: 'biological' as const })),
  partnerIds: person.partner ? [`example-${person.partner.id}`] : [],
  partnerships: person.partner ? [{ partnerId: `example-${person.partner.id}`, status: person.partner.status }] : [],
}));
