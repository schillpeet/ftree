'use client';

import Link from 'next/link';
import { useLanguage, useT } from './i18n';
import { GithubIcon } from './icons';

// "Terms · Privacy · GitHub" after the version in the footer; the legal pages open in the language chosen here.
export default function LegalLinks() {
  const t = useT();
  const [language] = useLanguage();
  return (
    <span className="legal-links">
      <Link href={`/terms?lang=${language}`}>{t.legal.terms}</Link>·<Link href={`/privacy?lang=${language}`}>{t.legal.privacy}</Link>·
      <a href="https://github.com/schillpeet/ftree" target="_blank" rel="noopener noreferrer" aria-label={t.landing.githubLabel}>
        <GithubIcon />
        GitHub
      </a>
    </span>
  );
}
