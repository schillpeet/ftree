'use client';

import { useT } from '../i18n';
import { rideFrom } from '../ride';
import { chipName, type ChipMe } from './chipName';

// The main button of the public pages: "Go to the tree" for signed-in people, else "Sign in", since only invited people
// get in and there is no registration. A plain link:
// `/start` and `/login` sit behind Cloudflare Access, which needs a full page load to sign in. Signed in, TRON rides into
// the tree; signed out, `/login` leads through signing in back to the landing page, so there is no ride.
export function StartButton({ me, className = '' }: { me: ChipMe | null | undefined; className?: string }) {
  const t = useT();
  const signedIn = chipName(me) !== null;
  return (
    <a
      className={`landing-primary ${className}`}
      href={signedIn ? '/start' : '/login'}
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full page load, as above
      onClick={signedIn ? (event) => rideFrom(event, () => location.assign('/start')) : undefined}
    >
      {signedIn ? t.landing.toTree : t.landing.signIn}
    </a>
  );
}

// The test-phase strip at the top of the public pages, for signed-out visitors only (`.landing-phase` in `landing.css`).
export function PhaseStrip({ me }: { me: ChipMe | null | undefined }) {
  const t = useT();
  return me === null ? <p className="landing-phase">{t.landing.phase}</p> : null;
}

// The small line under the main button: who is signed in, or that signing in needs an invitation; nothing while the
// `/me` probe runs.
export function StartNote({ me }: { me: ChipMe | null | undefined }) {
  const t = useT();
  if (me === undefined) return null;
  const name = chipName(me);
  return (
    <p className="landing-note">
      {name ? (
        t.landing.signedInAs(name)
      ) : (
        <>
          {t.landing.inviteOnly}
          <br />
          {t.landing.noCodeWithoutInvite}
        </>
      )}
    </p>
  );
}
