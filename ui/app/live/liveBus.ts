import type { LiveEvent } from './liveEvents';

// Hands the events of the open tree's stream to whoever shows or refetches data. Like the presence it lives outside
// React, since the scene renders in another root.
const listeners = new Set<(event: LiveEvent) => void>();

export function onLiveEvent(listener: (event: LiveEvent) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const emitLiveEvent = (event: LiveEvent) => listeners.forEach((listener) => listener(event));
