'use client';

import Link from 'next/link';
import { useLanguage, useT } from './i18n';
import { GithubIcon } from './icons';

// "Terms · Privacy · Imprint · FAQ · GitHub" after the version in the footer; the legal pages and the FAQ open in the language chosen
// here.
export default function LegalLinks() {
  const t = useT();
  const [language] = useLanguage();
  return (
    <span className="legal-links">
      <Link href={`/terms?lang=${language}`}>{t.legal.terms}</Link>·<Link href={`/privacy?lang=${language}`}>{t.legal.privacy}</Link>·
      <Link href={`/imprint?lang=${language}`}>{t.legal.imprint}</Link>·
      <Link href={`/home/faq?lang=${language}`}>{t.legal.faq}</Link>·
      <a href="https://github.com/schillpeet/ftree" target="_blank" rel="noopener noreferrer" aria-label={t.landing.githubLabel}>
        <GithubIcon />
        GitHub
      </a>
    </span>
  );
}
