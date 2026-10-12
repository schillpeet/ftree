'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import type { FamilySummary } from '../lib/api/generated/members';
import { APPEARANCES, useAppearance } from './appearance';
import { useT } from './i18n';
import { AppearanceIcon, BurgerIcon, ChevronIcon, CloseIcon, PersonIcon, UsersIcon } from './icons';

export type DashboardPanel = 'families' | 'people' | 'appearance';

// Top-left burger menu and the centred family switcher; the boards it opens are rendered by
// `FamiliesPanel` and `MembersControls` (the small appearance board lives here), the right-hand
// buttons by `Scene`.
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
  const t = useT();
  const [appearance, setAppearance] = useAppearance();
  const menuRef = useRef<HTMLDivElement>(null);
  const activeFamily = families?.find((family) => family.id === activeFamilyId);

  // A press outside the menu (or an Escape) closes the menu; while another board is open it handles both itself.
  useEffect(() => {
    if (!isOpen || (panel && panel !== 'appearance')) return;
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
    { id: 'families', label: t.menu.families, icon: <UsersIcon /> },
    { id: 'people', label: t.menu.people, icon: <PersonIcon /> },
    { id: 'appearance', label: t.menu.appearance, icon: <AppearanceIcon /> },
  ];

  return (
    <>
      <div className="dashboard-menu" data-panel-open={panel ? '' : undefined} ref={menuRef}>
        <button
          className="glass glass-button glass-icon"
          type="button"
          aria-expanded={isOpen}
          aria-controls="dashboard-nav"
          aria-label={isOpen ? t.menu.close : t.menu.open}
          onClick={onToggle}
        >
          {isOpen ? <CloseIcon /> : <BurgerIcon />}
        </button>
        {isOpen && (
          <nav className="glass dashboard-nav" id="dashboard-nav" aria-label={t.menu.label}>
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
        {isOpen && panel === 'appearance' && (
          <section className="glass dashboard-board" id="appearance-panel" aria-label={t.appearance.title}>
            <header className="dashboard-board-header">
              <AppearanceIcon />
              <h2>{t.appearance.title}</h2>
              <button type="button" aria-label={t.appearance.close} onClick={() => onPanel('appearance')}>
                <CloseIcon />
              </button>
            </header>
            <div className="appearance-panel-body" role="radiogroup" aria-label={t.appearance.title}>
              {APPEARANCES.map((option) => (
                <label key={option} className="debug-check">
                  <input
                    type="radio"
                    name="appearance"
                    checked={appearance === option}
                    onChange={() => setAppearance(option)}
                  />
                  {t.appearance[option]}
                </label>
              ))}
            </div>
          </section>
        )}
      </div>
      <div className="glass dashboard-family">
        <UsersIcon />
        <span className="dashboard-family-name">
          {activeFamily?.name ?? t.menu.noFamily}
        </span>
      </div>
    </>
  );
}
