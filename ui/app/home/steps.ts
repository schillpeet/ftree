// Which of the three steps on `/home/how` a signed-in person has done, from their trees: their own card in a tree, a
// tree shared with someone else, and a tree grown past its first person and one relative.
export type StepFamily = { selfMemberId?: string | null; accessCount: number; memberCount: number };

export function doneSteps(families: StepFamily[]): [boolean, boolean, boolean] {
  return [
    families.some((family) => !!family.selfMemberId),
    families.some((family) => family.accessCount > 1),
    families.some((family) => family.memberCount >= 3),
  ];
}
