'use client';

import { useT } from '../i18n';
import { chipName, type ChipMe } from './chipName';

// The main button of the public pages: "Your tree" for signed-in people, else `plant` ("Plant a tree"). A plain link:
// `/start` sits behind Cloudflare Access, which needs a full page load to sign in.
export function StartButton({ me, plant, className = '' }: { me: ChipMe | null | undefined; plant: string; className?: string }) {
  const t = useT();
  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a className={`landing-primary ${className}`} href="/start">
      {chipName(me) ? t.landing.toTree : plant}
    </a>
  );
}

// The small line under the main button: who is signed in, or that signing in needs an invitation; nothing while the
// `/me` probe runs.
export function StartNote({ me }: { me: ChipMe | null | undefined }) {
  const t = useT();
  if (me === undefined) return null;
  const name = chipName(me);
  return <p className="landing-note">{name ? t.landing.signedInAs(name) : t.landing.inviteOnly}</p>;
}
