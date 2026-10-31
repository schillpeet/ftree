'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useLanguage, useT } from '../i18n';
import { ChevronLeftIcon, LanguageIcon } from '../icons';
import { useCan, useMeLoaded } from '../Permissions';

// One route per tab, so a reload or a shared link stays on it; people keep their own sub-route for the chosen person.
const TABS = [
  { id: 'overview', href: '/admin' },
  { id: 'people', href: '/admin/people' },
  { id: 'invitations', href: '/admin/invitations' },
  { id: 'trees', href: '/admin/trees' },
  { id: 'audit', href: '/admin/audit' },
] as const;

const isCurrent = (pathname: string, href: string) =>
  href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

// Header, gate, and tab bar of every admin page. Only for `users.view` (admins); the BFF enforces the same rights on
// every admin endpoint, so the gate only decides what is shown.
export default function AdminShell({ children }: { children: ReactNode }) {
  const t = useT();
  const [language, setLanguage] = useLanguage();
  const pathname = usePathname();
  const meLoaded = useMeLoaded();
  const allowed = useCan('users.view');

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <>
      <header className="admin-header">
        <Link className="glass glass-button" href="/">
          <ChevronLeftIcon />
          {t.admin.back}
        </Link>
        <h1>{t.admin.title}</h1>
        <button
          type="button"
          className="glass glass-button"
          aria-label={t.language.switch}
          onClick={() => setLanguage(language === 'en' ? 'de' : 'en')}
        >
          <LanguageIcon />
          {t.language.short}
        </button>
      </header>
      {!meLoaded ? (
        <p className="admin-muted">{t.admin.loading}</p>
      ) : !allowed ? (
        <section className="glass admin-card" role="alert">
          <h2>{t.admin.noAccess}</h2>
          <p className="admin-muted">{t.admin.noAccessHint}</p>
        </section>
      ) : (
        <main>
          <nav className="admin-tabs" aria-label={t.admin.title}>
            {TABS.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className="glass glass-button"
                aria-current={isCurrent(pathname, tab.href) ? 'page' : undefined}
              >
                {t.admin.tabs[tab.id]}
              </Link>
            ))}
          </nav>
          {children}
        </main>
      )}
    </>
  );
}
