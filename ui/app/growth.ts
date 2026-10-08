// How far the aerial roots and roots of a ring around the tree have grown at a crown scale, from
// 0 to 1: ring 1 is always there, ring 2 grows while the crown goes from 1 to 1.5, ring 3 from 1.5 to 2.
export const growth = (ring: number, scale: number) => (ring <= 1 ? 1 : Math.min(1, Math.max(0, (scale - ring / 2) / 0.5)));
