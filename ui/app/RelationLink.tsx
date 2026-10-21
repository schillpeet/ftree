'use client';

import { useEffect, useRef } from 'react';

// A glowing, flowing line from the "… hinzufügen" button a new person was requested from to the panel that
// creates them, so it is clear which relation is being made. It follows both panels while they are dragged.
export default function RelationLink({ from, to }: { from: () => Element | null; to: () => Element | null }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let frame = 0;
    function draw() {
      frame = requestAnimationFrame(draw);
      const svg = svgRef.current;
      const source = from()?.getBoundingClientRect();
      const target = to()?.getBoundingClientRect();
      // Hidden while the relations tab (and so the button) is not shown.
      const visible = !!source && !!target && source.width > 0;
      svg?.setAttribute('data-visible', String(visible));
      if (!svg || !visible) return;
      const toRight = target.left + target.width / 2 >= source.left + source.width / 2;
      const sx = toRight ? source.right : source.left;
      const sy = source.top + source.height / 2;
      // The target's header, at the edge facing the button.
      const ex = toRight ? target.left : target.right;
      const ey = target.top + 26;
      // Straight along the button's row to the edge of its panel, then a curve through the gap; panels that
      // overlap (narrow screens) get one curve instead.
      const panel = from()?.closest('.person-panel')?.getBoundingClientRect();
      const edge = panel ? (toRight ? panel.right : panel.left) : sx;
      const gap = toRight ? ex - edge : edge - ex;
      const bendFrom = gap >= 16 ? edge : sx;
      const bend = Math.max(20, Math.abs(ex - bendFrom) / 2) * (toRight ? 1 : -1);
      const d = `M ${sx} ${sy} L ${bendFrom} ${sy} C ${bendFrom + bend} ${sy}, ${ex - bend} ${ey}, ${ex} ${ey}`;
      svg.querySelectorAll('path').forEach((path) => path.setAttribute('d', d));
      const [start, end] = svg.querySelectorAll('circle');
      start.setAttribute('cx', String(sx));
      start.setAttribute('cy', String(sy));
      end.setAttribute('cx', String(ex));
      end.setAttribute('cy', String(ey));
    }
    draw();
    return () => cancelAnimationFrame(frame);
  }, [from, to]);

  return (
    <svg className="relation-link" ref={svgRef} aria-hidden="true" data-visible="false">
      <path className="relation-link-glow" />
      <path className="relation-link-line" />
      <circle r="4" />
      <circle r="4" />
    </svg>
  );
}
