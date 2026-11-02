import type { MouseEvent } from 'react';

// The TRON ride from a landing page into a tree: the page derezzes (`.landing-riding` in `landing.css`), then `go`
// navigates, and the scene that loads there drives the camera in low over the grid (`takeRide` in `Scene.tsx`).
const RIDE_KEY = 'ftree.ride';
const EXIT_MS = 900;
// A ride that went through a sign-in page first is over by the time the tree loads.
const FRESH_MS = 15_000;

// Starts the ride for a plain click on a landing page in TRON; any other click is left to the link.
export function rideFrom(event: MouseEvent<HTMLElement>, go: () => void) {
  const page = event.currentTarget.closest('.landing');
  if (
    !page ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    document.documentElement.dataset.theme !== 'tron' ||
    !matchMedia('(prefers-reduced-motion: no-preference)').matches
  )
    return;
  event.preventDefault();
  page.classList.add('landing-riding');
  sessionStorage.setItem(RIDE_KEY, String(Date.now()));
  setTimeout(go, EXIT_MS);
}

// Whether this page load ends a ride; it can only be taken once.
export function takeRide() {
  const started = Number(sessionStorage.getItem(RIDE_KEY));
  sessionStorage.removeItem(RIDE_KEY);
  return Date.now() - started < FRESH_MS;
}
