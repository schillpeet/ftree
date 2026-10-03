import { useEffect, useRef, useState } from 'react';
import { layoutScrolls, DEFAULT_RADIUS } from './familyLayout';
import type { Member } from '../lib/api/generated/members';

const CANOPY_THRESHOLD = 0.95; // how close scrolls can be to canopy before growing
const VISIBLE_GROWTH_MS = 5000; // max visible animation duration

export default function useTreeGrowth(members: Member[] | null) {
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const items = members ?? [];
    const positions = layoutScrolls(items.map((m) => ({ id: m.id, parentIds: m.parentIds ?? [], partnerIds: m.partnerIds ?? [] })), DEFAULT_RADIUS);
    let maxR = 0;
    positions.forEach(([x, , z]) => {
      const r = Math.hypot(x, z);
      if (r > maxR) maxR = r;
    });
    const desired = Math.max(1, maxR / (DEFAULT_RADIUS * CANOPY_THRESHOLD));
    if (desired <= scaleRef.current * 1.0001) return; // no growth needed

    const start = performance.now();
    const initial = scaleRef.current;
    const delta = desired - initial;

    const step = (t: number) => {
      const elapsed = t - start;
      const frac = Math.min(1, elapsed / VISIBLE_GROWTH_MS);
      const eased = 1 - Math.pow(1 - frac, 3); // easeOutCubic
      const value = initial + delta * eased;
      scaleRef.current = value;
      setScale(value);
      if (frac < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        // after visible growth, apply gentle nudges every 500ms until covered
        const nudger = () => {
          const ps = layoutScrolls(items.map((m) => ({ id: m.id, parentIds: m.parentIds ?? [], partnerIds: m.partnerIds ?? [] })), DEFAULT_RADIUS);
          let mr = 0;
          ps.forEach(([x, , z]) => {
            const r = Math.hypot(x, z);
            if (r > mr) mr = r;
          });
          const needed = Math.max(1, mr / (DEFAULT_RADIUS * CANOPY_THRESHOLD));
          if (scaleRef.current >= needed * 0.999) return;
          scaleRef.current *= 1.01;
          setScale(scaleRef.current);
          setTimeout(nudger, 500);
        };
        setTimeout(nudger, 500);
      }
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [members]);

  return scale;
}
