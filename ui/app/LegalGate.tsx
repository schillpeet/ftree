'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { acceptLegalDocuments, type LegalDocumentNotice, type Me } from '../lib/api/generated/members';
import { useLanguage, useT } from './i18n';
import { consentCardOf, summaryLines } from './legal';
import './welcome.css';
import './legal-gate.css';

// The card that stands between a person and ftree while legal documents are open: first acceptance, new terms, or only a new
// privacy notice, which needs no tick because it is information, not consent. It is a modal `<dialog>`, so everything behind
// it, a form in progress included, stays as it is and out of reach, and it has no way to close but "Abmelden".
// Without open documents it shows at most a quiet line about a version that is announced.
export default function LegalGate({ me, onAccepted }: { me: Me | null | undefined; onAccepted: (me: Me) => void }) {
  const card = consentCardOf(me?.pendingLegal ?? []);
  if (card) return <ConsentDialog card={card} onAccepted={onAccepted} />;
  const announced = me?.announcedLegal[0];
  return announced ? <AnnouncedLine document={announced} /> : null;
}

function ConsentDialog({ card, onAccepted }: { card: NonNullable<ReturnType<typeof consentCardOf>>; onAccepted: (me: Me) => void }) {
  const t = useT().consent;
  const [language] = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const [ticked, setTicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const locale = language === 'de' ? 'de-DE' : 'en-GB';
  const date = (value: string) => new Date(value).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const link = (document: LegalDocumentNotice) => `/${document.kind}?lang=${language}&version=${document.version}`;
  const { state, terms, privacy, changes } = card;

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  async function accept() {
    setBusy(true);
    setFailed(false);
    try {
      const documents = [terms, privacy].filter((document) => document !== undefined).map(({ kind, version }) => ({ kind, version }));
      const response = await acceptLegalDocuments({ documents, language });
      if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
      setBusy(false);
      onAccepted(response.data);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  const heading = state === 'first' ? t.first.title : state === 'privacy' ? t.privacy.title : privacy ? t.changed.titleBoth : t.changed.title;
  return (
    // A modal dialog closes on Escape, and browsers do not always let a page stop that, so it also opens again at once.
    <dialog
      ref={dialog}
      className="glass invitation-card consent-card"
      aria-labelledby="consent-title"
      closedby="none"
      onCancel={(event) => event.preventDefault()}
      onClose={() => dialog.current?.showModal()}
    >
      <form
        className="consent-form"
        onSubmit={(event) => {
          event.preventDefault();
          void accept();
        }}
      >
        <span className="welcome-eyebrow">{state === 'first' ? t.first.eyebrow : t.changed.eyebrow}</span>
        <h1 id="consent-title">{heading}</h1>
        {state === 'first' && <p className="welcome-lead">{t.first.lead}</p>}
        {changes.map((document) => (
          <div className="consent-changes" key={document.kind}>
            <strong>{t.changed.version(document.version, date(document.effectiveAt))}</strong>
            <ul>
              {summaryLines(language === 'de' ? document.changeSummaryDe : document.changeSummaryEn).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ))}
        {terms && (
          <label className="consent-check">
            <input type="checkbox" required checked={ticked} onChange={(event) => setTicked(event.target.checked)} />
            <span>
              {t.acceptBefore}
              {/* In a new tab, so a form in progress behind the card stays. */}
              <Link href={link(terms)} target="_blank" rel="noopener">
                {t.terms}
              </Link>
              {state === 'first' ? t.acceptAfterVersion(terms.version) : t.acceptAfterNew}
            </span>
          </label>
        )}
        {terms && privacy && (
          <p className="consent-small">
            {t.acknowledgeBefore}
            <Link href={link(privacy)} target="_blank" rel="noopener">
              {t.privacyNotice}
            </Link>
            {t.acknowledgeAfter(privacy.version)}
          </p>
        )}
        {!terms && privacy && (
          <p className="consent-small">
            {t.privacy.information}
            <Link href={link(privacy)} target="_blank" rel="noopener">
              {t.privacy.read}
            </Link>
            .
          </p>
        )}
        {state === 'first' && <p className="consent-small">{t.first.cookies}</p>}
        {failed && (
          <p className="member-form-error" role="alert">
            {t.failed}
          </p>
        )}
        <div className="consent-actions">
          <button type="submit" className="consent-accept" disabled={busy || (!!terms && !ticked)}>
            {terms ? t.accept : t.privacy.accept}
          </button>
          {/* Cloudflare Access ends the session here; a full page load, not a route of this app. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="welcome-link" href="/cdn-cgi/access/logout">
            {t.signOut}
          </a>
        </div>
        {terms && <p className="consent-small">{t.disagree}</p>}
      </form>
    </dialog>
  );
}

function AnnouncedLine({ document }: { document: LegalDocumentNotice }) {
  const t = useT().consent;
  const [language] = useLanguage();
  const day = new Date(document.effectiveAt).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return (
    <p className="glass consent-announced" role="status">
      {document.kind === 'terms' ? t.announced.terms(day) : t.announced.privacy(day)}{' '}
      <Link href={`/${document.kind}?lang=${language}&version=${document.version}`}>{t.announced.view}</Link>
    </p>
  );
}
