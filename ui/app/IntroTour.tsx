'use client';

import { useEffect, useState } from 'react';
import { useT } from './i18n';
import './tour.css';

type Anchor = { left: number; right: number; top: number; bottom: number };

// How often the target is measured again; the camera may still be flying to the own card.
const MEASURE_MS = 250;
// The tooltip's width plus the gap it keeps to the screen edges.
const TIP_WIDTH = 330;
const MARGIN = 16;
const GAP = 14;

// The box of the first element matching `selector`, or null; re-measured while it moves.
function useAnchor(selector: string) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  useEffect(() => {
    const measure = () => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      const next = box ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom } : null;
      setAnchor((current) =>
        current && next && (['left', 'right', 'top', 'bottom'] as const).every((side) => Math.abs(current[side] - next[side]) < 1)
          ? current
          : next,
      );
    };
    measure();
    const timer = window.setInterval(measure, MEASURE_MS);
    return () => window.clearInterval(timer);
  }, [selector]);
  return anchor;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

// The three glass tooltips of the intro tour: the own card ("Das bist du."), the selected card ("Tippe auf ein +"), the
// dock ("Alles Wichtige unten"). Without a card on screen the first two stand in the middle. Esc skips.
export default function IntroTour({ step, onNext, onSkip }: { step: 0 | 1 | 2; onNext: () => void; onSkip: () => void }) {
  const t = useT();
  const text = t.tour.steps[step];
  const card = useAnchor('[data-self]');
  const dock = useAnchor('.dock-root');
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSkip();
    };
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [onSkip]);

  // Tooltips are centred on `x`, kept inside the window; `top` or `bottom` places them.
  const half = Math.min(TIP_WIDTH, width - 2 * MARGIN) / 2;
  const centre = (x: number) => clamp(x, MARGIN + half, width - MARGIN - half);
  let place: { left: number; top?: number; bottom?: number };
  if (step === 2) {
    place = dock
      ? { left: centre((dock.left + dock.right) / 2), bottom: window.innerHeight - dock.top + GAP }
      : { left: width / 2, bottom: 104 };
  } else if (card && step === 0) {
    place = { left: centre((card.left + card.right) / 2), top: card.bottom + GAP };
  } else if (card) {
    // Beside the card, on the side with more room.
    const right = width - card.right > card.left;
    place = { left: centre(right ? card.right + GAP + half : card.left - GAP - half), top: Math.max(MARGIN, card.top) };
  } else {
    place = { left: width / 2, top: window.innerHeight / 2 - 80 };
  }
  place.top = place.top === undefined ? undefined : clamp(place.top, MARGIN, window.innerHeight - 220);

  return (
    <div className="glass tour-tip" role="dialog" aria-label={t.tour.label} style={place}>
      <span className="tour-step">{t.tour.step(step + 1)}</span>
      <h2 className="tour-title">{text.title}</h2>
      <p className="tour-text">{text.text}</p>
      <div className="tour-actions">
        <button type="button" className="tour-skip" onClick={onSkip}>
          {t.tour.skip}
        </button>
        <button type="button" className="tour-next" autoFocus onClick={onNext}>
          {step === 2 ? t.tour.done : t.tour.next}
        </button>
      </div>
    </div>
  );
}
