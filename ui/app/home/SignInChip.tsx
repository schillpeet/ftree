'use client';

import { useT } from '../i18n';
import { chipName } from './chipName';
import { useSignedIn } from './signedIn';

// The small glass chip of the public headers: "Signed in as …" or "Sign in", both leading to `/start`.
export default function SignInChip() {
  const t = useT();
  const name = chipName(useSignedIn());
  return (
    // A plain link: `/start` sits behind Cloudflare Access, which needs a full page load to sign in.
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a className="glass landing-status" href="/start">
      {name ? t.landing.signedInAs(name) : t.landing.signIn}
    </a>
  );
}
