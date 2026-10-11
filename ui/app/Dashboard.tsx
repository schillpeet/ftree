'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import type { FamilySummary } from '../lib/api/generated/members';
import { BurgerIcon, ChevronIcon, CloseIcon, PersonIcon, UsersIcon } from './icons';

export type DashboardPanel = 'families' | 'people';

// Top-left burger menu and the centred family switcher; the boards it opens are rendered by
// `FamiliesPanel` and `MembersControls`, the right-hand buttons by `Scene`.
export default function Dashboard({
  isOpen,
  panel,
  families,
  activeFamilyId,
  onToggle,
  onPanel,
}: {
  isOpen: boolean;
  panel: DashboardPanel | null;
  families: FamilySummary[] | null;
  activeFamilyId: string | null;
  onToggle: () => void;
  onPanel: (panel: DashboardPanel) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const activeFamily = families?.find((family) => family.id === activeFamilyId);

  // A press outside the menu (or an Escape) closes the menu; while a board is open it handles both itself.
  useEffect(() => {
    if (!isOpen || panel) return;
    function closeOnOutsidePress(event: PointerEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target)) onToggle();
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onToggle();
    }
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, panel, onToggle]);

  const items: { id: DashboardPanel; label: string; icon: ReactNode }[] = [
    { id: 'families', label: 'Familien', icon: <UsersIcon /> },
    { id: 'people', label: 'Personen', icon: <PersonIcon /> },
  ];

  return (
    <>
      <div className="dashboard-menu" data-panel-open={panel ? '' : undefined} ref={menuRef}>
        <button
          className="glass glass-button glass-icon"
          type="button"
          aria-expanded={isOpen}
          aria-controls="dashboard-nav"
          aria-label={isOpen ? 'Menü schließen' : 'Menü öffnen'}
          onClick={onToggle}
        >
          {isOpen ? <CloseIcon /> : <BurgerIcon />}
        </button>
        {isOpen && (
          <nav className="glass dashboard-nav" id="dashboard-nav" aria-label="Menü">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="dashboard-nav-item"
                aria-expanded={panel === item.id}
                onClick={() => onPanel(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
                <ChevronIcon />
              </button>
            ))}
          </nav>
        )}
      </div>
      <div className="glass dashboard-family">
        <UsersIcon />
        <span className="dashboard-family-name">
          {activeFamily?.name ?? 'Keine Familie'}
        </span>
      </div>
    </>
  );
}
