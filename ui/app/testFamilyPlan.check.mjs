import assert from 'node:assert/strict';
import { planTestFamily } from './testFamilyPlan.ts';

function checkPlan(total, generations, minChildren, maxChildren) {
  const plan = planTestFamily(total, generations, minChildren, maxChildren);
  assert.ok(plan, `expected a valid plan for ${total} users in ${generations} generations`);
  assert.equal(plan.length, total);

  for (let generation = 0; generation < generations; generation++) {
    assert.ok(plan.some((person) => person.generation === generation), `generation ${generation + 1} is empty`);
  }

  for (let generation = 0; generation < generations - 1; generation++) {
    const parents = plan.map((person, index) => ({ ...person, index })).filter((person) => person.generation === generation);
    for (const parent of parents) {
      const children = plan.filter((person) => person.parentIndex === parent.index);
      assert.ok(children.length >= minChildren && children.length <= maxChildren);
      assert.ok(children.every((child) => child.generation === generation + 1));
    }
  }
}

function isFeasible(total, generations, minChildren, maxChildren) {
  const failed = new Set();
  function fill(generation, remaining, parentCount) {
    if (generation === generations) return remaining === 0;
    const key = `${generation}:${remaining}:${parentCount}`;
    if (failed.has(key)) return false;
    const minimum = Math.max(1, parentCount * minChildren);
    const maximum = Math.min(parentCount * maxChildren, remaining - (generations - generation - 1));
    for (let count = minimum; count <= maximum; count++) {
      if (fill(generation + 1, remaining - count, count)) return true;
    }
    failed.add(key);
    return false;
  }

  if (generations === 1) return total > 0;
  for (let firstCount = 1; firstCount <= total - (generations - 1); firstCount++) {
    if (fill(1, total - firstCount, firstCount)) return true;
  }
  return false;
}

checkPlan(12, 3, 0, 3);
checkPlan(4, 2, 0, 2);
checkPlan(24, 4, 1, 3);
checkPlan(6, 3, 1, 1);
checkPlan(3, 1, 0, 0);
assert.deepEqual(
  [0, 1, 2].map((generation) => planTestFamily(12, 3, 0, 3).filter((person) => person.generation === generation).length),
  [1, 3, 8],
);
assert.equal(planTestFamily(5, 3, 1, 1), null);
assert.equal(planTestFamily(2, 3, 0, 0), null);
assert.equal(planTestFamily(12, 3, 2, 1), null);

for (let total = 1; total <= 20; total++) {
  for (let generations = 1; generations <= 5; generations++) {
    for (let minChildren = 0; minChildren <= 3; minChildren++) {
      for (let maxChildren = minChildren; maxChildren <= 3; maxChildren++) {
        assert.equal(
          planTestFamily(total, generations, minChildren, maxChildren) !== null,
          isFeasible(total, generations, minChildren, maxChildren),
          `feasibility mismatch for ${total} users, ${generations} generations, ${minChildren}-${maxChildren} children`,
        );
      }
    }
  }
}

console.log('testFamilyPlan ok');
