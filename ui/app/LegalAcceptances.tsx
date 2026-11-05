'use client';

import { useLanguage, useT } from './i18n';
import type { LegalAcceptance } from '../lib/api/generated/members';

// What a person accepted, newest first: on their profile and on their page in `/admin`.
export default function LegalAcceptances({ acceptances, className }: { acceptances: readonly LegalAcceptance[]; className?: string }) {
  const t = useT().consent.list;
  const [language] = useLanguage();
  const locale = language === 'de' ? 'de-DE' : 'en-GB';
  return (
    <ul className={className}>
      {acceptances.map((acceptance) => (
        <li key={`${acceptance.kind}-${acceptance.version}`}>
          <span className="profile-invite">
            <a href={`/${acceptance.kind}?lang=${language}&version=${acceptance.version}`} target="_blank" rel="noopener">
              {t[acceptance.kind]}
            </a>
            <small>{t.line(acceptance.version, new Date(acceptance.acceptedAt).toLocaleDateString(locale), acceptance.language.toUpperCase())}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}
