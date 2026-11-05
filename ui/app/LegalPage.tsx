import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ChevronLeftIcon, LanguageIcon } from './icons';
import { fillOperator, legalInForce, legalVersionOf, parseLegalBody } from './legal';
import { legalDocument } from './legalDocuments';
import { operator } from './operator';
import './legal.css';

const TEXTS = {
  de: {
    lang: 'de',
    back: 'Zurück zu ftree',
    switchLanguage: 'English',
    switchTo: 'en',
    unset: 'nicht hinterlegt',
    binding: 'Maßgeblich ist diese deutsche Fassung.',
    terms: 'Nutzungsbedingungen',
    privacy: 'Datenschutzhinweise',
    imprint: 'Impressum',
    imprintHeading: 'Angaben nach § 18 Abs. 1 MStV',
    emailLabel: 'E-Mail',
    version: (version: number, date: string) => `Version ${version}, gültig seit ${date}.`,
    announced: (version: number, date: string) => `Version ${version}, gültig ab ${date}.`,
    versions: 'Alle Fassungen',
    unavailable: 'Der Text kann gerade nicht geladen werden. Bitte versuche es gleich noch einmal.',
  },
  en: {
    lang: 'en',
    back: 'Back to ftree',
    switchLanguage: 'Deutsch',
    switchTo: 'de',
    unset: 'not configured',
    binding: 'This translation is for information only; the German version is binding.',
    terms: 'Terms of use',
    privacy: 'Privacy policy',
    imprint: 'Imprint',
    imprintHeading: 'Information under section 18(1) of the German Interstate Media Treaty (MStV)',
    emailLabel: 'Email',
    version: (version: number, date: string) => `Version ${version}, in force since ${date}.`,
    announced: (version: number, date: string) => `Version ${version}, in force from ${date}.`,
    versions: 'All versions',
    unavailable: 'The text cannot be loaded right now. Please try again in a moment.',
  },
};

// The frame of a legal page: the way back, the language, and the title.
function Frame({ t, title, languageHref, children }: { t: (typeof TEXTS)['de']; title: string; languageHref: string; children: ReactNode }) {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <Link className="glass glass-button" href="/home">
          <ChevronLeftIcon />
          {t.back}
        </Link>
        <Link className="glass glass-button" href={languageHref} hrefLang={t.switchTo}>
          <LanguageIcon />
          {t.switchLanguage}
        </Link>
      </header>
      <main lang={t.lang}>
        <h1>{title}</h1>
        {children}
      </main>
    </div>
  );
}

// `/imprint`: who runs this instance, from the server's environment; it is no versioned document and needs no BFF.
export async function ImprintPage({ lang }: { lang: string | string[] | undefined }) {
  const t = lang === 'en' ? TEXTS.en : TEXTS.de;
  const op = await operator();
  return (
    <Frame t={t} title={t.imprint} languageHref={`/imprint?lang=${t.switchTo}`}>
      <h2>{t.imprintHeading}</h2>
      <p>{`${op.name ?? t.unset}\n${op.address ?? t.unset}`}</p>
      <p>{`${t.emailLabel}: ${op.email ?? t.unset}`}</p>
    </Frame>
  );
}

// `/terms` and `/privacy`: public, server-rendered pages (Cloudflare lets them through without login), whose text comes from
// the BFF (`legalDocuments.ts`). `?lang=` picks the language, German unless it is `en`; `?version=` an older or announced
// version instead of the one in force.
export default async function LegalPage({
  page,
  lang,
  version,
}: {
  page: 'terms' | 'privacy';
  lang: string | string[] | undefined;
  version: string | string[] | undefined;
}) {
  const t = lang === 'en' ? TEXTS.en : TEXTS.de;
  const op = await operator();
  const requested = legalVersionOf(version);
  const document = await legalDocument(page, requested);
  if (document === null) notFound();
  const locale = t.lang === 'de' ? 'de-DE' : 'en-GB';
  const date = (value: string) => new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
  const versionQuery = requested === undefined ? '' : `&version=${requested}`;
  const body = document && fillOperator(t.lang === 'en' ? document.bodyEn : document.bodyDe, { name: op.name ?? t.unset, email: op.email ?? t.unset });
  return (
    <Frame t={t} title={t[page]} languageHref={`/${page}?lang=${t.switchTo}${versionQuery}`}>
      {document && body ? (
        <>
          <p className="legal-muted">
            {(legalInForce(document.effectiveAt) ? t.version : t.announced)(document.version, date(document.effectiveAt))} {t.binding}
          </p>
          {parseLegalBody(body).map((block, i) => {
            if (block.kind === 'list') {
              return (
                <ul key={i}>
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              );
            }
            return block.kind === 'heading' ? <h2 key={i}>{block.text}</h2> : <p key={i}>{block.text}</p>;
          })}
          {document.versions.length > 1 && (
            <nav className="legal-versions" aria-label={t.versions}>
              <h2>{t.versions}</h2>
              <ul>
                {document.versions.map((item) => (
                  <li key={item.version}>
                    <Link href={`/${page}?lang=${t.lang}&version=${item.version}`} aria-current={item.version === document.version ? 'page' : undefined}>
                      {(legalInForce(item.effectiveAt) ? t.version : t.announced)(item.version, date(item.effectiveAt))}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </>
      ) : (
        <p role="status">{t.unavailable}</p>
      )}
    </Frame>
  );
}
