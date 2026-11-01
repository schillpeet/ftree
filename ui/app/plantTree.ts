import { createEmptyFamily, createFamilyMember, setSelfMember, type FamilySummary } from '../lib/api/generated/members';
import type { Language } from './i18n';
import { problemCode } from './problems';

export type PlantInput = { firstName: string; lastName: string; language?: Language };

// What an attempt got done before it failed; passing it back resumes there, so a retry never creates a second family.
export type PlantProgress = { family?: FamilySummary; memberId?: string };

export type PlantFailure = 'treeLimit' | 'createFamily' | 'createMember' | 'linkSelf';

export class PlantError extends Error {
  constructor(
    readonly failure: PlantFailure,
    readonly progress: PlantProgress,
  ) {
    super(failure);
  }
}

// "Familie Berger" / "Berger family"; without a last name just "Familie" / "Family".
export function plantedFamilyName(lastName: string, language: Language = 'de') {
  const last = lastName.trim();
  if (language === 'de') return last ? `Familie ${last}` : 'Familie';
  return last ? `${last} family` : 'Family';
}

const NAME_ATTEMPTS = 5;

// Plants the user's first tree: an empty family named after them, then the user as its first person, then the link that
// makes that person the user (`selfMemberId`). A taken name gets " 2", " 3", … Fails with a PlantError that says which
// step stopped and what exists by then; a retry passes `progress` back to continue with the missing steps.
export async function plantTree(
  input: PlantInput,
  progress: PlantProgress = {},
): Promise<{ family: FamilySummary; memberId: string }> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  let family = progress.family;
  if (!family) {
    const base = plantedFamilyName(lastName, input.language);
    for (let attempt = 1; !family; attempt++) {
      const name = attempt === 1 ? base : `${base} ${attempt}`.slice(0, 100);
      let response;
      try {
        response = await createEmptyFamily({ name });
      } catch {
        throw new PlantError('createFamily', {});
      }
      const code = problemCode(response.data);
      if (response.status === 201) family = response.data;
      else if (code === 'NAME_TAKEN' && attempt < NAME_ATTEMPTS) continue;
      else throw new PlantError(code === 'TREE_LIMIT_REACHED' ? 'treeLimit' : 'createFamily', {});
    }
  }
  let memberId = progress.memberId;
  if (!memberId) {
    try {
      const response = await createFamilyMember(family.id, { firstName, lastName });
      if (response.status !== 201) throw new Error(`HTTP ${response.status}`);
      memberId = response.data.id;
    } catch {
      throw new PlantError('createMember', { family });
    }
  }
  try {
    const response = await setSelfMember(family.id, { memberId });
    if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
    return { family: response.data, memberId };
  } catch {
    throw new PlantError('linkSelf', { family, memberId });
  }
}
