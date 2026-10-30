'use client';

import { toPng } from 'html-to-image';
import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';
import type { FamilySummary } from '../lib/api/generated/members';
import { APPEARANCES, useAppearance } from './appearance';
import { PUBLIC_APPEARANCE } from './access';
import { useT } from './i18n';
import { BurgerIcon, CameraIcon, ChevronIcon, CloseIcon, MailIcon, PaletteIcon, SettingsIcon, UserIcon, UserPlusIcon, UsersIcon } from './icons';
import TreeSwitcher from './TreeSwitcher';
import { Can, useCan, useMe, useMeLoaded } from './Permissions';

export type DashboardPanel = 'profile' | 'families' | 'appearance';

// Boards drawn here inside the menu, which closes with them on a press outside.
const OWN_PANELS: (DashboardPanel | null)[] = [null, 'profile', 'appearance'];

// Top-left burger menu and the centred family name, which opens the family card (with several trees, a switcher sits
// beside it); the boards it opens are rendered by `FamiliesPanel` and `MembersControls` (the small profile and appearance
// boards live here; the admin page has its own route), the right-hand buttons by `Scene`.
export default function Dashboard({
  isOpen,
  panel,
  families,
  activeFamilyId,
  feedbackEmail,
  onToggle,
  onPanel,
  onAddMember,
  onFamilyClick,
}: {
  isOpen: boolean;
  panel: DashboardPanel | null;
  families: FamilySummary[] | null;
  activeFamilyId: string | null;
  // The operator's address (`OPERATOR_EMAIL`); without it the menu has no "Feedback" entry.
  feedbackEmail?: string;
  onToggle: () => void;
  onPanel: (panel: DashboardPanel) => void;
  onAddMember: () => void;
  // Opens the family card, or the families board while no family is shown.
  onFamilyClick: () => void;
}) {
  const t = useT();
  const [appearance, setAppearance] = useAppearance();
  const mayChooseAppearance = useCan('tree.appearance');
  const me = useMe();
  const meLoaded = useMeLoaded();
  const menuRef = useRef<HTMLDivElement>(null);
  const activeFamily = families?.find((family) => family.id === activeFamilyId);
  // Whoever sees more than one tree switches between them at the family name.
  const switchable = !!families && families.length > 1;

  // A press outside the menu (or an Escape) closes the menu; while another board is open it handles both itself.
  useEffect(() => {
    if (!isOpen || !OWN_PANELS.includes(panel)) return;
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
            {boardItem('profile', t.menu.profile, <UserIcon />)}
            <Can permission="family.create">{boardItem('families', t.menu.families, <UsersIcon />)}</Can>
            <Can permission="member.edit">
              <button type="button" className="dashboard-nav-item" disabled={!activeFamily} onClick={onAddMember}>
                <UserPlusIcon />
                <span>{t.members.add}</span>
              </button>
            </Can>
            {boardItem('appearance', t.menu.appearance, <PaletteIcon />)}
            <Can permission="users.view">
              <Link className="dashboard-nav-item" href="/admin">
                <SettingsIcon />
                <span>{t.menu.admin}</span>
                <ChevronIcon />
              </Link>
            </Can>
            <button type="button" className="dashboard-nav-item" onClick={() => void takeSnapshot()}>
              <CameraIcon />
              <span>{t.menu.snapshot}</span>
            </button>
            {feedbackEmail && (
              <a className="dashboard-nav-item" href={`mailto:${feedbackEmail}?subject=ftree%20Feedback`}>
                <MailIcon />
                <span>{t.menu.feedback}</span>
              </a>
            )}
          </nav>
        )}
        {isOpen && panel === 'profile' && (
          <section className="glass dashboard-board" id="profile-panel" aria-label={t.account.title}>
            <header className="dashboard-board-header">
              <UserIcon />
              <h2>{t.account.title}</h2>
              <button type="button" aria-label={t.account.close} onClick={() => onPanel('profile')}>
                <CloseIcon />
              </button>
            </header>
            <div className="profile-panel-body">
              <h3 className="dashboard-subhead">{t.account.private}</h3>
              {me ? (
                <dl className="profile-facts">
                  <dt>{t.account.email}</dt>
                  <dd>{me.email}</dd>
                  <dt>{t.account.role}</dt>
                  <dd>
                    {me.admin
                      ? t.account.roles.admin
                      : activeFamily
                        ? t.account.roles[activeFamily.role]
                        : t.account.noFamily}
                  </dd>
                  <dt>{t.account.verification}</dt>
                  <dd>{me.verified ? t.account.verified : t.account.unverified}</dd>
                </dl>
              ) : (
                <p className="person-muted">{meLoaded ? t.account.unavailable : t.account.loading}</p>
              )}
              {/* Ends the Cloudflare Access session; locally there is none, so the link only leads to a 404. */}
              {/* Cloudflare answers this path, not the app, so it needs a full page load; the `[slug]` route only looks alike. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a className="profile-logout" href="/cdn-cgi/access/logout">
                {t.account.logout}
              </a>
            </div>
          </section>
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
              {APPEARANCES.map((option) => {
                // Without `tree.appearance` the other appearances are announced, not offered.
                const soon = !mayChooseAppearance && option !== PUBLIC_APPEARANCE;
                return (
                  <label key={option} className="debug-check" data-disabled={soon ? '' : undefined}>
                    <input
                      type="radio"
                      name="appearance"
                      checked={appearance === option}
                      disabled={soon}
                      onChange={() => setAppearance(option)}
                    />
                    {t.appearance[option]}
                    {soon && <span className="appearance-soon">{t.appearance.comingSoon}</span>}
                  </label>
                );
              })}
            </div>
          </section>
        )}
      </div>
      {switchable ? (
        <TreeSwitcher families={families ?? []} activeFamily={activeFamily ?? null} onFamilyClick={onFamilyClick} />
      ) : (
        <button
          type="button"
          className="glass dashboard-family"
          title={activeFamily ? t.familyCard.open(activeFamily.name) : t.menu.families}
          onClick={onFamilyClick}
        >
          <UsersIcon />
          <span className="dashboard-family-name">{activeFamily?.name ?? t.menu.noFamily}</span>
        </button>
      )}
    </>
  );
}
