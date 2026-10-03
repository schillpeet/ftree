export type TestFamilyPlanEntry = {
  generation: number;
  parentIndex: number | null;
};

export function planTestFamily(
  totalUsers: number,
  generationCount: number,
  minChildren: number,
  maxChildren: number,
): TestFamilyPlanEntry[] | null {
  if (
    !Number.isInteger(totalUsers) ||
    !Number.isInteger(generationCount) ||
    !Number.isInteger(minChildren) ||
    !Number.isInteger(maxChildren) ||
    totalUsers < 1 ||
    generationCount < 1 ||
    minChildren < 0 ||
    maxChildren < minChildren
  ) {
    return null;
  }

  if (generationCount === 1) {
    return Array.from({ length: totalUsers }, () => ({ generation: 0, parentIndex: null }));
  }

  const failed = new Set<string>();
  function findLaterGenerations(
    generation: number,
    remaining: number,
    parentCount: number,
  ): number[] | null {
    const key = `${generation}:${remaining}:${parentCount}`;
    if (failed.has(key)) return null;

    const minimum = Math.max(1, parentCount * minChildren);
    const maximum = Math.min(parentCount * maxChildren, remaining - (generationCount - generation - 1));
    if (minimum > maximum) {
      failed.add(key);
      return null;
    }

    if (generation === generationCount - 1) {
      if (remaining >= minimum && remaining <= parentCount * maxChildren) return [remaining];
      failed.add(key);
      return null;
    }

    const target = Math.min(maximum, Math.max(minimum, Math.round(remaining / (generationCount - generation))));
    for (let distance = 0; distance <= maximum - minimum; distance++) {
      const candidates = distance === 0 ? [target] : [target - distance, target + distance];
      for (const count of candidates) {
        if (count < minimum || count > maximum) continue;
        const later = findLaterGenerations(generation + 1, remaining - count, count);
        if (later) return [count, ...later];
      }
    }

    failed.add(key);
    return null;
  }

  const maximumFirstGeneration = totalUsers - (generationCount - 1);
  if (maximumFirstGeneration < 1) return null;
  let populationCounts: number[] | null = null;
  for (let firstCount = 1; firstCount <= maximumFirstGeneration; firstCount++) {
    const later = findLaterGenerations(1, totalUsers - firstCount, firstCount);
    if (later) {
      populationCounts = [firstCount, ...later];
      break;
    }
  }
  if (!populationCounts) return null;

  const entries: TestFamilyPlanEntry[] = [];
  const generationIndexes: number[][] = [];
  for (let generation = 0; generation < generationCount; generation++) {
    generationIndexes[generation] = [];
    for (let index = 0; index < populationCounts[generation]; index++) {
      const entryIndex = entries.length;
      entries.push({ generation, parentIndex: null });
      generationIndexes[generation].push(entryIndex);
    }
  }

  for (let generation = 0; generation < generationCount - 1; generation++) {
    const parents = generationIndexes[generation];
    const children = generationIndexes[generation + 1];
    const childCounts = parents.map(() => minChildren);
    let remainingChildren = children.length - parents.length * minChildren;
    let parent = 0;

    while (remainingChildren > 0) {
      if (childCounts[parent] < maxChildren) {
        childCounts[parent]++;
        remainingChildren--;
      }
      parent = (parent + 1) % parents.length;
    }

    let childOffset = 0;
    parents.forEach((parentIndex, index) => {
      for (let child = 0; child < childCounts[index]; child++) {
        entries[children[childOffset++]].parentIndex = parentIndex;
      }
    });
  }

  return entries;
}
