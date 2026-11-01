'use client';

import Link from 'next/link';
import { useT } from '../i18n';

// "← Back" next to the brand on the pages below the landing page.
export default function BackLink() {
  const t = useT();
  return (
    <Link className="glass landing-back" href="/home">
      <span aria-hidden="true">←</span> {t.landing.back}
    </Link>
  );
}
