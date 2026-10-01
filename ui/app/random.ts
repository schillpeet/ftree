// Seeded PRNG (mulberry32) so procedural content looks the same on every load.
export function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cheap smooth pseudo-noise: a few sine waves in random directions, roughly in [-1, 1].
export function makeNoise(seed: number, octaves: number) {
  const rand = seededRandom(seed);
  const waves = Array.from({ length: octaves }, (_, i) => {
    const a = rand() * Math.PI * 2;
    return { dx: Math.cos(a), dz: Math.sin(a), f: 2 ** i, phase: rand() * 100 };
  });
  return (x: number, z: number) =>
    waves.reduce((s, w) => s + Math.sin((x * w.dx + z * w.dz) * w.f + w.phase) / w.f, 0) / 1.6;
}
