'use client';

import Link from 'next/link';
import { useT } from './i18n';
import './treeRoute.css';

// Shown for a URL whose slug names no tree the caller may see; the BFF hides other families entirely, so unknown and
// forbidden look the same. `home` is the caller's first tree, null when they have none.
export default function TreeNotFound({ home }: { home: string | null }) {
  const t = useT();
  return (
    <section className="glass tree-not-found" role="alert">
      <h2>{t.treeRoute.notFound}</h2>
      <p>{t.treeRoute.notFoundHint}</p>
      {home && (
        <Link className="glass glass-button" href={home}>
          {t.treeRoute.backHome}
        </Link>
      )}
    </section>
  );
}
