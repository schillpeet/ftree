'use client';

import { useT } from '../i18n';
import { chipName, type ChipMe } from './chipName';
import { useSignedIn } from './signedIn';
import './landing.css';

// "Signed in as …": plain text on a glass chip, not a link, since the person is signed in already.
export function SignedInChip({ me }: { me: ChipMe | null }) {
  const t = useT();
  const name = chipName(me);
  if (!name) return null;
  return <span className="glass landing-status landing-status-static">{t.landing.signedInAs(name)}</span>;
}

// The small glass chip of the public headers: "Signed in as …" (text only) or "Sign in", which leads to `/start`.
export default function SignInChip() {
  const t = useT();
  const me = useSignedIn();
  if (chipName(me)) return <SignedInChip me={me} />;
  return (
    // A plain link: `/start` sits behind Cloudflare Access, which needs a full page load to sign in.
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a className="glass landing-status" href="/start">
      {t.landing.signIn}
    </a>
  );
}
