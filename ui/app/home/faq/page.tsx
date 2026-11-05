import type { Metadata } from 'next';
import Link from 'next/link';
import { faqTexts } from '../../faqTexts';
import { ChevronLeftIcon, LanguageIcon } from '../../icons';
import '../../legal.css';

export const metadata: Metadata = {
  title: 'ftree · FAQ',
};

// Questions and answers, under `/home` and public like the landing page; laid out like the legal
// pages, with the language from `?lang=` and every entry reachable by its anchor.
export default async function FaqPage({ searchParams }: PageProps<'/home/faq'>) {
  const t = faqTexts((await searchParams).lang);
  return (
    <div className="legal-page">
      <header className="legal-header">
        <Link className="glass glass-button" href="/home">
          <ChevronLeftIcon />
          {t.back}
        </Link>
        <Link className="glass glass-button" href={`/home/faq?lang=${t.switchTo}`} hrefLang={t.switchTo}>
          <LanguageIcon />
          {t.switchLanguage}
        </Link>
      </header>
      <main lang={t.lang}>
        <h1>{t.title}</h1>
        {t.entries.map((entry) => (
          <section key={entry.id} id={entry.id}>
            <h2>{entry.question}</h2>
            {entry.body.map((part, i) =>
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
