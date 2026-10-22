'use client';

import { toPng } from 'html-to-image';
import { useEffect, useRef, type ReactNode } from 'react';
import type { FamilySummary } from '../lib/api/generated/members';
import { APPEARANCES, useAppearance } from './appearance';
import { useT } from './i18n';
import { BurgerIcon, CameraIcon, ChevronIcon, CloseIcon, PaletteIcon, UserPlusIcon, UsersIcon } from './icons';

export type DashboardPanel = 'families' | 'appearance';

// Top-left burger menu and the centred family name, which opens the family card; the boards it opens are rendered by
// `FamiliesPanel` and `MembersControls` (the small appearance board lives here), the right-hand
// buttons by `Scene`.
export default function Dashboard({
  isOpen,
  panel,
  families,
  activeFamilyId,
  onToggle,
  onPanel,
  onAddMember,
  onFamilyClick,
}: {
  isOpen: boolean;
  panel: DashboardPanel | null;
  families: FamilySummary[] | null;
  activeFamilyId: string | null;
  onToggle: () => void;
  onPanel: (panel: DashboardPanel) => void;
  onAddMember: () => void;
  // Opens the family card, or the families board while no family is shown.
  onFamilyClick: () => void;
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

  const boardItem = (id: DashboardPanel, label: string, icon: ReactNode) => (
    <button key={id} type="button" className="dashboard-nav-item" aria-expanded={panel === id} onClick={() => onPanel(id)}>
      {icon}
      <span>{label}</span>
      <ChevronIcon />
    </button>
  );

  // Pictures the page as it looks without the menu, keeping only the scene (canvas and its HTML
  // labels) and the family name; the canvas needs `preserveDrawingBuffer` to be readable.
  async function takeSnapshot() {
    onToggle();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = document.querySelector('canvas');
    const link = document.createElement('a');
    link.href = await toPng(document.body, {
      width: window.innerWidth,
      height: window.innerHeight,
      filter: (node) =>
        node.parentElement !== document.body ||
        (node instanceof Element && (node.contains(canvas) || node.classList.contains('dashboard-family'))),
    });
    // Swedish dates read yyyy-mm-dd, in local time.
    const day = new Date().toLocaleDateString('sv-SE');
    link.download = `ftree-${(activeFamily?.name ?? 'tree').replace(/[^\p{L}\p{N}]+/gu, '-')}-${day}.png`;
    link.click();
  }

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
            {boardItem('families', t.menu.families, <UsersIcon />)}
            <button type="button" className="dashboard-nav-item" disabled={!activeFamily} onClick={onAddMember}>
              <UserPlusIcon />
              <span>{t.members.add}</span>
            </button>
            {boardItem('appearance', t.menu.appearance, <PaletteIcon />)}
            <button type="button" className="dashboard-nav-item" onClick={() => void takeSnapshot()}>
              <CameraIcon />
              <span>{t.menu.snapshot}</span>
            </button>
          </nav>
        )}
        {isOpen && panel === 'appearance' && (
          <section className="glass dashboard-board" id="appearance-panel" aria-label={t.appearance.title}>
            <header className="dashboard-board-header">
              <PaletteIcon />
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
      <button
        type="button"
        className="glass dashboard-family"
        title={activeFamily ? t.familyCard.open(activeFamily.name) : t.menu.families}
        onClick={onFamilyClick}
      >
        <UsersIcon />
        <span className="dashboard-family-name">
          {activeFamily?.name ?? t.menu.noFamily}
        </span>
      </button>
    </>
  );
}
