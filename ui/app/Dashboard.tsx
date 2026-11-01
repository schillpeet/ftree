'use client';

import { toPng } from 'html-to-image';
import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';
import type { FamilySummary } from '../lib/api/generated/members';
import { useT } from './i18n';
import { BurgerIcon, CameraIcon, ChevronIcon, CloseIcon, ExternalLinkIcon, LogoutIcon, MailIcon, SettingsIcon, UserIcon, UsersIcon } from './icons';
import { Can } from './Permissions';
import ProfilePanel from './ProfilePanel';

export type DashboardPanel = 'profile' | 'families';

// Boards drawn here inside the menu, which closes with them on a press outside.
const OWN_PANELS: (DashboardPanel | null)[] = [null, 'profile'];

// The burger menu at the header's right end (rendered inside `Header`); the boards it opens are rendered by
// `FamiliesPanel` and `MembersControls` (the small profile board lives here; the admin page has its own route).
export default function Dashboard({
  isOpen,
  panel,
  families,
  activeFamilyId,
  feedbackEmail,
  onToggle,
  onPanel,
}: {
  isOpen: boolean;
  panel: DashboardPanel | null;
  families: FamilySummary[] | null;
  activeFamilyId: string | null;
  // The operator's address (`OPERATOR_EMAIL`); without it the menu has no "Feedback" entry.
  feedbackEmail?: string;
  onToggle: () => void;
  onPanel: (panel: DashboardPanel) => void;
}) {
  const t = useT();
  const menuRef = useRef<HTMLDivElement>(null);
  const activeFamily = families?.find((family) => family.id === activeFamilyId);

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
  // labels) and the header's family name; the canvas needs `preserveDrawingBuffer` to be readable.
  async function takeSnapshot() {
    onToggle();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = document.querySelector('canvas');
    const header = document.querySelector('.app-header');
    const link = document.createElement('a');
    link.href = await toPng(document.body, {
      width: window.innerWidth,
      height: window.innerHeight,
      filter: (node) => {
        if (node.parentElement === document.body) {
          return node instanceof Element && (node.contains(canvas) || node.classList.contains('app-header'));
        }
        // In the header only the family name stays.
        return node.parentElement !== header || (node instanceof Element && node.classList.contains('dashboard-family'));
      },
    });
    // Swedish dates read yyyy-mm-dd, in local time.
    const day = new Date().toLocaleDateString('sv-SE');
    link.download = `ftree-${(activeFamily?.name ?? 'tree').replace(/[^\p{L}\p{N}]+/gu, '-')}-${day}.png`;
    link.click();
  }

  return (
    <div className="dashboard-menu" data-panel-open={panel ? '' : undefined} ref={menuRef}>
      <button
        className="glass header-button header-button-icon"
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
          {/* Only where admins have their rights: locally, and not on the tree's host when the administration has its own. */}
          <Can permission="users.view">
            <Link className="dashboard-nav-item" href="/admin">
              <SettingsIcon />
              <span>{t.menu.admin}</span>
              <ExternalLinkIcon />
            </Link>
          </Can>
          <hr className="dashboard-nav-divider" />
          {/* Ends the Cloudflare Access session; locally there is none, so the link only leads to a 404. */}
          {/* Cloudflare answers this path, not the app, so it needs a full page load; the `[slug]` route only looks alike. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="dashboard-nav-item" href="/cdn-cgi/access/logout">
            <LogoutIcon />
            <span>{t.account.logout}</span>
          </a>
        </nav>
      )}
      {isOpen && panel === 'profile' && <ProfilePanel families={families} activeFamily={activeFamily} onClose={() => onPanel('profile')} />}
    </div>
  );
}
