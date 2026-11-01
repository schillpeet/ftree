'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from './i18n';
import { DockInviteIcon, DockPlusIcon, DockSearchIcon, DockViewIcon } from './icons';
import './dock.css';

export type CameraView = 'front' | 'above' | 'orbit';

const VIEWS: CameraView[] = ['front', 'above', 'orbit'];

type Props = {
  // The caller may add members / share the open family. Without the permission the button is hidden.
  canAdd: boolean;
  canShare: boolean;
  // Whether a family is open; without one Person and Einladen stay visible but disabled, with the reason as title.
  hasFamily?: boolean;
  onPerson: () => void;
  onSearch: () => void;
  onInvite: () => void;
  onView: (view: CameraView) => void;
};

// The bottom dock: the primary "Person" action, then search, invitation and the camera view as icon-over-label buttons.
export default function Dock({ canAdd, canShare, hasFamily = true, onPerson, onSearch, onInvite, onView }: Props) {
  const t = useT();
  const [viewOpen, setViewOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const reason = hasFamily ? undefined : t.dock.needsFamily;

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

  return (
    <div className="dock-root" ref={rootRef}>
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
        {(canAdd || !hasFamily) && (
          <button
            type="button"
            className="dock-primary"
            disabled={!hasFamily}
            title={reason}
            onClick={() => {
              setViewOpen(false);
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
          onClick={() => {
            setViewOpen(false);
            onSearch();
          }}
        >
          <DockSearchIcon />
          {t.dock.search}
        </button>
        {(canShare || !hasFamily) && (
          <button
            type="button"
            className="dock-item"
            disabled={!hasFamily}
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
