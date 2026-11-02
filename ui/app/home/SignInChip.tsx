'use client';

import { useT } from '../i18n';
import { chipName, type ChipMe } from './chipName';
import './landing.css';

// "Signed in as …": plain text on a glass chip, not a link, since the person is signed in already.
export function SignedInChip({ me }: { me: ChipMe | null }) {
  const t = useT();
  const name = chipName(me);
  if (!name) return null;
  return <span className="glass landing-status landing-status-static">{t.landing.signedInAs(name)}</span>;
}

// "Sign in" in the public headers, for signed-out visitors only: signed-in people find their name under the main button
// (`StartNote`), and nothing shows while the `/me` probe runs.
export default function SignInChip({ me }: { me: ChipMe | null | undefined }) {
  const t = useT();
  if (me !== null) return null;
  return (
    // A plain link: `/start` sits behind Cloudflare Access, which needs a full page load to sign in.
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a className="glass landing-status" href="/start">
      {t.landing.signIn}
    </a>
  );
}
