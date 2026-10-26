'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { useLanguage, useT } from '../i18n';
import { ChevronLeftIcon, LanguageIcon } from '../icons';
import { useCan, useMeLoaded } from '../Permissions';
import OverviewTab from './OverviewTab';
import TreesTab from './TreesTab';

// One entry per tab; people, invitations and the audit log follow as tabs of their own.
const TABS = ['overview', 'trees'] as const;
type Tab = (typeof TABS)[number];

const PANELS: Record<Tab, () => ReactNode> = {
  overview: () => <OverviewTab />,
  trees: () => <TreesTab />,
};

// Only for `users.view` (admins); the BFF enforces the same rights on every admin endpoint.
export default function AdminPage() {
  const t = useT();
  const [language, setLanguage] = useLanguage();
  const meLoaded = useMeLoaded();
  const allowed = useCan('users.view');
  const [tab, setTab] = useState<Tab>('overview');

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
          <div className="admin-tabs" role="tablist" aria-label={t.admin.title}>
            {TABS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`admin-tab-${id}`}
                aria-selected={tab === id}
                aria-controls="admin-panel"
                className="glass glass-button"
                onClick={() => setTab(id)}
              >
                {t.admin.tabs[id]}
              </button>
            ))}
          </div>
          <div id="admin-panel" role="tabpanel" aria-labelledby={`admin-tab-${tab}`}>
            {PANELS[tab]()}
          </div>
        </main>
      )}
    </>
  );
}
