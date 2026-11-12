'use client';

import type { ReactNode } from 'react';
import { EyeOffIcon, FoldIcon } from './icons';
import { useT } from './i18n';
import { useLegendFolded } from './lines';
import Sheet from './Sheet';
import { BLOOD_COLOR } from './SimpleTree';

// The lines' colours as the tree draws them: idle, and on the selected person's lineage.
const LINE = 'var(--line-on)';
const DIM = 'var(--line-dim)';

// A short stretch of line as the experimental view draws it, with an optional mark in the middle.
function Sample({ color = DIM, dash, children }: { color?: string; dash?: string; children?: ReactNode }) {
  return (
    <svg className="relation-legend-sample" viewBox="0 0 40 14" aria-hidden>
      <line x1="2" y1="7" x2="38" y2="7" style={{ stroke: color }} strokeWidth="2" strokeDasharray={dash} strokeLinecap={dash ? 'round' : undefined} />
      {children}
    </svg>
  );
}

// The key to the experimental view's lines, symbols, and labels. Folded (remembered per browser) it is a small chip in the
// bottom right corner; unfolded a narrow panel there, which keeps clear of the dock, and on phones a bottom sheet at half
// height while the dock steps aside (`Sheet.tsx`). Escape and × fold it again; the eye hides it until the Evolution panel
// shows it again.
export default function RelationLegend({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [folded, setFolded] = useLegendFolded();
  const glyph = (symbol: string) => (
    <span className="relation-legend-sample relation-legend-glyph" aria-hidden>
      {symbol}
    </span>
  );
  const entries: [ReactNode, string][] = [
    [<Sample key="solid" />, t.legend.lineage],
    [<Sample key="dashed" dash="6 5" />, t.legend.ended],
    [<Sample key="dotted" dash="0.5 4" />, t.legend.notBiological],
    [
      <Sample key="dot">
        <line x1="20" y1="7" x2="20" y2="14" style={{ stroke: DIM }} strokeWidth="2" />
        <circle cx="20" cy="7" r="3" style={{ fill: DIM }} />
      </Sample>,
      t.legend.branch,
    ],
    [
      <svg key="bridge" className="relation-legend-sample" viewBox="0 0 40 14" aria-hidden>
        <path d="M2 10 H15 A5 5 0 0 1 25 10 H38 M20 2 V14" fill="none" style={{ stroke: DIM }} strokeWidth="2" />
      </svg>,
      t.legend.bridge,
    ],
    [<Sample key="focus" color={LINE} />, t.legend.focus],
    [<Sample key="blood" color={BLOOD_COLOR} />, t.legend.blood],
    [glyph('⚭'), t.legend.married],
    [glyph('⚯'), t.legend.together],
    [glyph('⚮'), t.legend.divorced],
    [<span key="stub" className="relation-legend-stub" aria-hidden>▲</span>, t.legend.stub],
    [glyph('†'), t.legend.deceased],
  ];
  if (folded) {
    return (
      <button type="button" className="glass legend-chip" aria-expanded={false} aria-label={t.legend.unfold} title={t.legend.unfold} onClick={() => setFolded(false)}>
        <span className="relation-legend-glyph" aria-hidden>
          ⚭
        </span>
        {t.legend.title}
        <FoldIcon />
      </button>
    );
  }
  return (
    <Sheet
      place="corner"
      initialSnap="half"
      className="relation-legend"
      label={t.legend.title}
      eyebrow={t.legend.title}
      closeLabel={t.legend.fold}
      onClose={() => setFolded(true)}
      actions={
        <button type="button" className="person-icon-button" aria-label={t.legend.close} title={t.legend.close} onClick={onClose}>
          <EyeOffIcon />
        </button>
      }
    >
      <ul className="legend-rows">
        {entries.map(([sample, text]) => (
          <li key={text}>
            {sample}
            {text}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
