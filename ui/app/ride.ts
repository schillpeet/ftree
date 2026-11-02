import type { MouseEvent } from 'react';

// The TRON rides between the landing and a tree. Into the tree: the page derezzes (`.landing-riding` in `landing.css`),
// then `go` navigates, and the scene that loads there drives the camera in low over the grid (`takeRide` in
// `Scene.tsx`). Back: the scene pulls its camera back along the grid until the tree is a point on the horizon, a flash
// covers the page (`.riding-out` in `globals.css`), and the landing builds itself up again (`.landing-arriving`).
const RIDE_KEY = 'ftree.ride';
const RIDE_BACK_KEY = 'ftree.rideBack';
const EXIT_MS = 900;
const BACK_MS = 1400;
// A ride that went through a sign-in page first is over by the time the tree loads.
const FRESH_MS = 15_000;

// A plain click in TRON that may move; any other click is left to the link.
function mayRide(event: MouseEvent<HTMLElement>) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    document.documentElement.dataset.theme === 'tron' &&
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
