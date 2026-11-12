'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import type { DashboardPanel } from '../Dashboard';
import { useMenuDismiss } from '../menuDismiss';
import { useT } from '../i18n';
import { BurgerIcon, ChevronIcon, CloseIcon, LoginIcon, LogoutIcon, UserIcon, UsersIcon } from '../icons';

// The landing page's burger menu, top right like in the tree but shorter: signed in only Profil, Familien (with
// `family.create`, as in the tree) and Abmelden; signed out only Anmelden. While the `/me` probe runs it has no entries.
export default function HomeMenu({
  signedIn,
  canFamilies,
  onPanel,
}: {
  // undefined while the probe runs.
  signedIn: boolean | undefined;
  canFamilies: boolean;
  onPanel: (panel: DashboardPanel) => void;
}) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setIsOpen(false), []);
  useMenuDismiss(menuRef, isOpen, close);

  const board = (panel: DashboardPanel, label: string, icon: ReactNode) => (
    <button
      type="button"
      className="dashboard-nav-item"
      onClick={() => {
        setIsOpen(false);
        onPanel(panel);
      }}
    >
      {icon}
      <span>{label}</span>
      <ChevronIcon />
    </button>
  );

  return (
    <div className="dashboard-menu" ref={menuRef}>
      <button
        className="glass header-button header-button-icon"
        type="button"
        aria-expanded={isOpen}
        aria-controls="home-menu"
        aria-label={isOpen ? t.menu.close : t.menu.open}
        disabled={signedIn === undefined}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? <CloseIcon /> : <BurgerIcon />}
      </button>
      {isOpen && (
        <nav className="glass dashboard-nav" id="home-menu" aria-label={t.menu.label}>
          {signedIn ? (
            <>
              {board('profile', t.menu.profile, <UserIcon />)}
              {canFamilies && board('families', t.menu.families, <UsersIcon />)}
              <hr className="dashboard-nav-divider" />
              {/* Cloudflare answers this path, not the app, so it needs a full page load (see Dashboard.tsx). */}
              <a className="dashboard-nav-item" href={`/cdn-cgi/access/logout?returnTo=${encodeURIComponent(`${location.origin}/home`)}`}>
                <LogoutIcon />
                <span>{t.account.logout}</span>
              </a>
            </>
          ) : (
            // `/login` sits behind Cloudflare Access and leads back here once signed in, like the main button; Access needs
            // a full page load.
            // eslint-disable-next-line @next/next/no-html-link-for-pages
            <a className="dashboard-nav-item" href="/login">
              <LoginIcon />
              <span>{t.landing.signIn}</span>
            </a>
          )}
        </nav>
      )}
    </div>
  );
}
