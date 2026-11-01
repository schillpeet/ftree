'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from './i18n';
import { DockInviteIcon, DockPlusIcon, DockSearchIcon, DockViewIcon } from './icons';
import './dock.css';

export type CameraView = 'front' | 'above' | 'orbit';

const VIEWS: CameraView[] = ['front', 'above', 'orbit'];
// How long the hint to the "+" slots stays.
const SLOT_HINT_MS = 4_000;

type Props = {
  // The caller may add members / share the open family. Without the permission the button is hidden.
  canAdd: boolean;
  canShare: boolean;
  // Whether a family is open; without one Person and Einladen stay visible but disabled, with the reason as title.
  hasFamily?: boolean;
  // Whether the open tree's invitation is not accepted yet; Person, Suche and Einladen then stay disabled with the reason.
  locked?: boolean;
  // Whether a person is selected, around whom "+" slots offer the missing relatives; Person then also points to them.
  hasSelection?: boolean;
  onPerson: () => void;
  onSearch: () => void;
  onInvite: () => void;
  onView: (view: CameraView) => void;
};

// The bottom dock: the primary "Person" action, then search, invitation and the camera view as icon-over-label buttons.
export default function Dock({
  canAdd,
  canShare,
  hasFamily = true,
  locked = false,
  hasSelection = false,
  onPerson,
  onSearch,
  onInvite,
  onView,
}: Props) {
  const t = useT();
  const [viewOpen, setViewOpen] = useState(false);
  // A new number per Person click with a selection, so a second click restarts the hint's time.
  const [slotHint, setSlotHint] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const reason = !hasFamily ? t.dock.needsFamily : locked ? t.dock.needsAccept : undefined;
  const disabled = !hasFamily || locked;

  useEffect(() => {
    if (!viewOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setViewOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [viewOpen]);

  useEffect(() => {
    if (slotHint === null) return;
    const timer = setTimeout(() => setSlotHint(null), SLOT_HINT_MS);
    return () => clearTimeout(timer);
  }, [slotHint]);

  return (
    <div className="dock-root" ref={rootRef}>
      {slotHint !== null && hasSelection && (
        <div className="glass dock-hint" role="status">
          {t.slots.dockHint}
        </div>
      )}
      {viewOpen && (
        <div className="glass dock-popover" role="menu" aria-label={t.dock.viewMenu}>
          {VIEWS.map((view) => (
            <button
              key={view}
              type="button"
              role="menuitem"
              onClick={() => {
                setViewOpen(false);
                onView(view);
              }}
            >
              {t.dock[view]}
            </button>
          ))}
        </div>
      )}
      <nav className="glass dock" data-dock aria-label={t.dock.label}>
        {(canAdd || disabled) && (
          <button
            type="button"
            className="dock-primary"
            disabled={disabled}
            title={reason}
            onClick={() => {
              setViewOpen(false);
              if (hasSelection) setSlotHint((current) => (current ?? 0) + 1);
              onPerson();
            }}
          >
            <DockPlusIcon />
            {t.dock.person}
          </button>
        )}
        <button
          type="button"
          className="dock-item"
          disabled={locked}
          title={locked ? reason : undefined}
          onClick={() => {
            setViewOpen(false);
            onSearch();
          }}
        >
          <DockSearchIcon />
          {t.dock.search}
        </button>
        {(canShare || disabled) && (
          <button
            type="button"
            className="dock-item"
            disabled={disabled}
            title={reason}
            onClick={() => {
              setViewOpen(false);
              onInvite();
            }}
          >
            <DockInviteIcon />
            {t.dock.invite}
          </button>
        )}
        <button
          type="button"
          className="dock-item"
          aria-haspopup="menu"
          aria-expanded={viewOpen}
          onClick={() => setViewOpen((open) => !open)}
        >
          <DockViewIcon />
          {t.dock.view}
        </button>
      </nav>
    </div>
  );
}
