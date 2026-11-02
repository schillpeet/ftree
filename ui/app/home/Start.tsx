'use client';

import { useT } from '../i18n';
import { rideFrom } from '../ride';
import { chipName, type ChipMe } from './chipName';

// The main button of the public pages: "Your tree" for signed-in people, else `plant` ("Plant a tree"). A plain link:
// `/start` sits behind Cloudflare Access, which needs a full page load to sign in. Signed in, TRON rides into the tree;
// signed out, the way leads to signing in, so there is no ride.
export function StartButton({ me, plant, className = '' }: { me: ChipMe | null | undefined; plant: string; className?: string }) {
  const t = useT();
  const signedIn = chipName(me) !== null;
  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a
      className={`landing-primary ${className}`}
      href="/start"
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full page load, as above
      onClick={signedIn ? (event) => rideFrom(event, () => location.assign('/start')) : undefined}
    >
      {signedIn ? t.landing.toTree : plant}
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
