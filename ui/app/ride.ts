import { useEffect, type MouseEvent } from 'react';

// The TRON rides between the landing and a tree. Into the tree: the page derezzes (`.landing-riding` in `landing.css`),
// then `go` navigates, and the scene that loads there drives the camera in low over the grid (`takeRide` in
// `Scene.tsx`). Back: the scene pulls its camera back along the grid until the tree is a point on the horizon, a flash
// covers the page (`.riding-out` in `globals.css`), and the landing builds itself up again (`.landing-arriving`).
const RIDE_KEY = 'ftree.ride';
const RIDE_BACK_KEY = 'ftree.rideBack';
// Both match the CSS: `EXIT_MS` the landing's exit (`tron-flash` in `landing.css`), `BACK_MS` the scene's pull-back and
// its flash (`tron-flash-out` in `globals.css`).
const EXIT_MS = 2400;
const BACK_MS = 2000;
// A ride that went through a sign-in page first is over by the time the tree loads.
const FRESH_MS = 15_000;

// A plain click in TRON with its animations on (`motion.ts`) that may move; any other click is left to the link.
function mayRide(event: MouseEvent<HTMLElement>) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    document.documentElement.dataset.theme === 'tron' &&
    document.documentElement.dataset.motion === 'on' &&
    matchMedia('(prefers-reduced-motion: no-preference)').matches
  );
}

// Starts the ride into a tree from a landing page.
export function rideFrom(event: MouseEvent<HTMLElement>, go: () => void) {
  const page = event.currentTarget.closest('.landing');
  if (!page || !mayRide(event)) return;
  event.preventDefault();
  page.classList.add('landing-riding');
  sessionStorage.setItem(RIDE_KEY, String(Date.now()));
  setTimeout(go, EXIT_MS);
}

// A page the browser restores from its back/forward cache keeps `landing-riding`, so Back after a ride would show the
// landing derezzed; the landing pages call this to drop it.
export function useRideReset() {
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) document.querySelector('.landing-riding')?.classList.remove('landing-riding');
    };
    addEventListener('pageshow', reset);
    return () => removeEventListener('pageshow', reset);
  }, []);
}

// How the scene on screen pulls its camera back, while there is one in TRON.
let pullBack: (() => void) | null = null;
export function onRideBack(handler: (() => void) | null) {
  pullBack = handler;
}

// Starts the ride from a tree back to the landing.
export function rideBack(event: MouseEvent<HTMLElement>, go: () => void) {
  if (!pullBack || !mayRide(event)) return;
  event.preventDefault();
  document.documentElement.classList.add('riding-out');
  sessionStorage.setItem(RIDE_BACK_KEY, String(Date.now()));
  pullBack();
  setTimeout(go, BACK_MS);
}

// Whether this page ends a ride (`back`: on the landing); it can only be taken once.
export function takeRide(back = false) {
  const key = back ? RIDE_BACK_KEY : RIDE_KEY;
  const started = Number(sessionStorage.getItem(key));
  sessionStorage.removeItem(key);
  return Date.now() - started < FRESH_MS;
}
