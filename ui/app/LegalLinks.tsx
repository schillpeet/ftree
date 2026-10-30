'use client';

import Link from 'next/link';
import { useLanguage, useT } from './i18n';

// "Terms · Privacy" beside the version badge; the pages open in the language chosen here.
export default function LegalLinks() {
  const t = useT();
  const [language] = useLanguage();
  return (
    <span className="legal-links">
      <Link href={`/terms?lang=${language}`}>{t.legal.terms}</Link>·<Link href={`/privacy?lang=${language}`}>{t.legal.privacy}</Link>
    </span>
  );
}
