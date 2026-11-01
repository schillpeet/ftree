import Link from 'next/link';
import { ChevronLeftIcon, LanguageIcon } from './icons';
import { legalTexts } from './legalTexts';
import { operator } from './operator';
import './legal.css';

// `/terms` and `/privacy`: plain server-rendered pages without any BFF call, so they work signed out (Cloudflare lets
// them through without login). The language comes from `?lang=`, German unless it is `en`.
export default async function LegalPage({ page, lang }: { page: 'terms' | 'privacy'; lang: string | string[] | undefined }) {
  const t = legalTexts(lang);
  const op = await operator();
  const sections = t[page].sections({ name: op.name ?? t.unset, email: op.email ?? t.unset });
  return (
    <div className="legal-page">
      <header className="legal-header">
        <Link className="glass glass-button" href="/home">
          <ChevronLeftIcon />
          {t.back}
        </Link>
        <Link className="glass glass-button" href={`/${page}?lang=${t.switchTo}`} hrefLang={t.switchTo}>
          <LanguageIcon />
          {t.switchLanguage}
        </Link>
      </header>
      <main lang={t.lang}>
        <h1>{t[page].title}</h1>
        <p className="legal-muted">
          {t.updated}. {t.binding}
        </p>
        {sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((part, i) =>
              typeof part === 'string' ? (
                <p key={i}>{part}</p>
              ) : (
                <ul key={i}>
                  {part.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
