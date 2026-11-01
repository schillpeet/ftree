'use client';

import { useRef, useState, type ReactNode } from 'react';
import { CloseIcon, FoldIcon, PinIcon } from './icons';
import { useT } from './i18n';
import { useLegendFolded } from './lines';
import { CENTRE, type Offset } from './panelPosition';
import { usePanelDrag, usePanelPin } from './PersonPanel';
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

// The key to the experimental view's lines, symbols, and labels: lines in the left column, symbols and
// labels in the right. It sits in the bottom right corner, can be folded to its header (remembered per
// browser), and can be dragged by its header; like the person panel, a pinned position is remembered
// and cannot be dragged.
export default function RelationLegend({ onClose }: { onClose: () => void }) {
  const t = useT();
  const panelRef = useRef<HTMLElement>(null);
  const [pin, setPin] = usePanelPin('ftree.legendPin');
  const [moved, setMoved] = useState<Offset>(CENTRE);
  const [folded, setFolded] = useLegendFolded();
  const offset = pin ?? moved;
  const dragHandle = usePanelDrag(panelRef, offset, (next) => (pin ? setPin(next) : setMoved(next)), !!pin);
  const togglePin = () => {
    if (pin) {
      setMoved(pin);
      setPin(null);
    } else setPin(moved);
  };
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
  return (
    <aside
      className="glass relation-legend"
      aria-label={t.legend.title}
      ref={panelRef}
      data-folded={folded}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
      <header className="person-header" {...dragHandle}>
        <span className="person-header-label">{t.legend.title}</span>
        <span className="person-header-actions">
          <button
            type="button"
            className="person-icon-button person-pin"
            aria-pressed={!!pin}
            aria-label={pin ? t.profile.unpin : t.profile.pin}
            title={pin ? t.profile.unpin : t.profile.pin}
            onClick={togglePin}
          >
            <PinIcon />
          </button>
          <button
            type="button"
            className="person-icon-button relation-legend-fold"
            aria-expanded={!folded}
            aria-controls="relation-legend-list"
            aria-label={folded ? t.legend.unfold : t.legend.fold}
            title={folded ? t.legend.unfold : t.legend.fold}
            onClick={() => setFolded(!folded)}
          >
            <FoldIcon />
          </button>
          <button type="button" className="person-icon-button" aria-label={t.legend.close} title={t.legend.close} onClick={onClose}>
            <CloseIcon />
          </button>
        </span>
      </header>
      <ul id="relation-legend-list" hidden={folded}>
        {entries.map(([sample, text]) => (
          <li key={text}>
            {sample}
            {text}
          </li>
        ))}
      </ul>
    </aside>
  );
}
