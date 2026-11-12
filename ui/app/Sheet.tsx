'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from './i18n';
import { CloseIcon } from './icons';
import { snapAfterDrag, type Snap } from './sheetSnap';
import './sheet.css';

// How many sheets are open; while any is, `<html data-sheet-open>` lets the dock step aside on phones (`sheet.css`).
let openSheets = 0;

// The one surface for what opens from the menu (Profil, Familien) and for the relation legend: a glass card in the middle
// over a veil (`place="card"`), or a narrow panel in the bottom right corner (`place="corner"`, no veil); below 700px both
// are a bottom sheet with a grip that rests at three heights (`sheetSnap.ts`). It lives in `document.body`, outside the
// header, so the header and the dock never cover it. Escape, the × and (for a card) a press on the veil close it.
export default function Sheet({
  label,
  eyebrow,
  closeLabel,
  onClose,
  footer,
  actions,
  place = 'card',
  initialSnap = 'full',
  id,
  className = '',
  children,
}: {
  label: string;
  // The small title in the accent colour, with its icon.
  eyebrow: ReactNode;
  closeLabel: string;
  onClose: () => void;
  // Stays at the bottom while the body scrolls.
  footer?: ReactNode;
  // Buttons before the ×.
  actions?: ReactNode;
  place?: 'card' | 'corner';
  initialSnap?: Snap;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const t = useT();
  const sheetRef = useRef<HTMLElement>(null);
  const [snap, setSnap] = useState<Snap>(initialSnap);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const drag = useRef<{ startY: number; startHeight: number } | null>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    openSheets += 1;
    document.documentElement.setAttribute('data-sheet-open', '');
    sheetRef.current?.focus({ preventScroll: true });
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.defaultPrevented) close.current();
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      openSheets -= 1;
      if (openSheets === 0) document.documentElement.removeAttribute('data-sheet-open');
    };
  }, []);

  function onGripDown(event: ReactPointerEvent<HTMLButtonElement>) {
    const height = sheetRef.current?.getBoundingClientRect().height ?? 0;
    drag.current = { startY: event.clientY, startHeight: height };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onGripMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    setDragHeight(Math.max(60, drag.current.startHeight - (event.clientY - drag.current.startY)));
  }

  function onGripUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    const { startY, startHeight } = drag.current;
    drag.current = null;
    setDragHeight(null);
    const next = snapAfterDrag(snap, startHeight, event.clientY - startY, window.innerHeight);
    if (next === 'close') onClose();
    else setSnap(next);
  }

  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      {place === 'card' && <div className="sheet-veil" aria-hidden="true" onClick={onClose} />}
      <section
        className={`glass sheet ${className}`}
        id={id}
        ref={sheetRef}
        role={place === 'card' ? 'dialog' : 'region'}
        aria-modal={place === 'card' || undefined}
        aria-label={label}
        tabIndex={-1}
        data-place={place}
        data-snap={snap}
        data-dragging={dragHeight !== null || undefined}
        style={dragHeight !== null ? { height: dragHeight } : undefined}
      >
        <button
          type="button"
          className="sheet-grip"
          aria-label={t.sheet.resize}
          title={t.sheet.resize}
          onPointerDown={onGripDown}
          onPointerMove={onGripMove}
          onPointerUp={onGripUp}
          onPointerCancel={() => {
            drag.current = null;
            setDragHeight(null);
          }}
        >
          <span />
        </button>
        <header className="sheet-head">
          <span className="sheet-eyebrow">{eyebrow}</span>
          <span className="sheet-actions">
            {actions}
            <button type="button" className="person-icon-button" aria-label={closeLabel} title={closeLabel} onClick={onClose}>
              <CloseIcon />
            </button>
          </span>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </section>
    </>,
    document.body,
  );
}
