import { useSyncExternalStore } from 'react';

// The finished intro tour is remembered per browser, so it runs once.
const TOUR_DONE_KEY = 'ftree.tourDone';

type Tour = { active: boolean; step: 0 | 1 | 2 };

const IDLE: Tour = { active: false, step: 0 };

// Shared by every component that calls `useTour`: a welcome or invitation card starts the tour, `IntroTour` shows it.
let tour = IDLE;
const listeners = new Set<() => void>();

function set(next: Tour) {
  tour = next;
  for (const listener of listeners) listener();
}

function isDone() {
  try {
    return localStorage.getItem(TOUR_DONE_KEY) !== null;
  } catch {
    return false;
  }
}

function finish() {
  try {
    localStorage.setItem(TOUR_DONE_KEY, '1');
  } catch {
    // Without storage the tour may run again next time.
  }
  set(IDLE);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

// Does nothing once the tour was finished or skipped in this browser.
export function startTour() {
  if (!tour.active && !isDone()) set({ active: true, step: 0 });
}

export function nextTourStep() {
  if (!tour.active) return;
  if (tour.step === 2) finish();
  else set({ active: true, step: tour.step === 0 ? 1 : 2 });
}

export const skipTour = finish;

// The server render has no tour.
export function useTour() {
  const state = useSyncExternalStore(subscribe, () => tour, () => IDLE);
  return { active: state.active, step: state.step, startTour, next: nextTourStep, skip: skipTour };
}
