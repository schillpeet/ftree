import { useEffect, useSyncExternalStore } from 'react';
import type { Location } from './sky';

// Whether the sun follows the browser's location instead of the time zone. Off unless switched on, and only that switch is
// remembered per browser, never the position, which stays in this page's memory and is never sent anywhere. Only the click
// may raise the browser's prompt: a later visit reads the location again only if the browser already allows it.
const LOCATION_KEY = 'ftree.location';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
// An unanswered lookup counts as unavailable, so the switch does not stay on without effect.
const TIMEOUT_MS = 15_000;

let position: Location | null = null;
let asking = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());
const isOn = () => localStorage.getItem(LOCATION_KEY) === 'on';

function remember(on: boolean) {
  if (on) localStorage.setItem(LOCATION_KEY, 'on');
  else localStorage.removeItem(LOCATION_KEY);
  notify();
}

function locate(onRefused?: () => void) {
  asking = true;
  const refuse = () => {
    asking = false;
    if (!isOn()) return;
    remember(false);
    onRefused?.();
  };
  if (!navigator.geolocation) return refuse();
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      asking = false;
      position = { latitude: coords.latitude, longitude: coords.longitude };
      notify();
    },
    refuse,
    { maximumAge: MAX_AGE_MS, timeout: TIMEOUT_MS },
  );
}

// The toggle's click, the only place that may raise the prompt. Denied or unavailable, the switch goes back off and
// `onRefused` says so.
export function setLocationOn(on: boolean, onRefused?: () => void) {
  remember(on);
  if (on) locate(onRefused);
  else position = null;
}

// A page load with the switch on: reads the location only if the browser allows it without asking, else switches off.
export async function resumeLocation() {
  if (asking || position || !isOn()) return;
  const state = await navigator.permissions?.query({ name: 'geolocation' }).then(
    (status) => status.state,
    () => null,
  );
  if (state === 'granted') locate();
  else if (!asking && isOn()) remember(false);
}

// Also fires for the switch in another tab (`storage`).
export function onLocationChange(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

// Wherever the switch shows, a remembered "on" is checked against what the browser allows.
export function useLocationOn() {
  const on = useSyncExternalStore(onLocationChange, isOn, () => false);
  useEffect(() => {
    if (on) void resumeLocation();
  }, [on]);
  return on;
}

// The position the sun follows, or null for the time zone.
export function useSunLocation(): Location | null {
  const on = useLocationOn();
  const current = useSyncExternalStore(onLocationChange, () => position, () => null);
  return on ? current : null;
}
