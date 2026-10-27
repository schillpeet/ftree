'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { getStreamFamilyEventsUrl, updateFamilyPresence, type PresentClient } from '../../lib/api/generated/members';
import { emitLiveEvent } from './liveBus';
import { parseLiveEvent } from './liveEvents';
import { HEARTBEAT_MS, isIdle, parsePresence, reconnectDelay } from './presence';

// The presence lives outside React: drei's <Html> renders the scrolls in another root, which gets no context, so every
// reader subscribes to this store instead.
const NOBODY: PresentClient[] = [];
let present = NOBODY;
const listeners = new Set<() => void>();

function setPresent(next: PresentClient[]) {
  present = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Every browser tab in the open tree, as the last `presence` event listed them.
export const usePresent = () => useSyncExternalStore(subscribe, () => present, () => NOBODY);

// One id per page load, so a duplicated tab is a tab of its own.
let clientId: string | null = null;
function ownClientId() {
  clientId ??= Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return clientId;
}

// The events that tell about saved changes; see liveEvents.ts.
const SAVED_EVENTS = ['member-changed', 'member-deleted', 'family-changed'] as const;

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;

// Joins the tree's event stream while a family is open and keeps this tab's presence there: what it views or edits
// and whether it is idle, sent on every change and as a heartbeat. The stream reopens after the browser gives up on it.
export function useTreeEvents(familyId: string | null, viewing: string | null, editing: string | null) {
  // Read by the heartbeat; the effect below sends a change right away through `sendChange`.
  const state = useRef({ viewing, editing });
  const sendChange = useRef(() => {});

  useEffect(() => {
    if (!familyId) return;
    let stopped = false;
    let source: EventSource | null = null;
    let failures = 0;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let lastActivity = Date.now();
    let idle = isIdle(document.hidden, lastActivity, lastActivity);
    // The last presence sent, so unchanged state only goes out with the heartbeat.
    let sent = '';
    // Nothing is sent before the stream opens, which sends the whole state anyway.
    let joined = false;
    // Whether the stream was open before: opening it again means events may have been missed.
    let wasOpen = false;

    function send(force = false) {
      const update = { clientId: ownClientId(), viewing: state.current.viewing, editing: state.current.editing, idle };
      const body = JSON.stringify(update);
      if (stopped || !joined || (!force && body === sent)) return;
      sent = body;
      // A failed heartbeat is retried by the next one; the stream reconnects on its own.
      updateFamilyPresence(familyId!, update).catch(() => undefined);
    }

    function refreshIdle() {
      const next = isIdle(document.hidden, lastActivity, Date.now());
      if (next === idle) return;
      idle = next;
      send();
    }

    function onActivity() {
      lastActivity = Date.now();
      if (idle) refreshIdle();
    }

    function open() {
      source = new EventSource(getStreamFamilyEventsUrl(familyId!, { clientId: ownClientId() }));
      source.addEventListener('open', () => {
        failures = 0;
        joined = true;
        // Opening the stream joins the tree as active and viewing nothing; correct that at once.
        send(true);
        if (wasOpen) emitLiveEvent({ kind: 'resync' });
        wasOpen = true;
      });
      for (const name of SAVED_EVENTS) {
        source.addEventListener(name, (event) => {
          const saved = parseLiveEvent(name, (event as MessageEvent<string>).data);
          if (saved) emitLiveEvent(saved);
        });
      }
      source.addEventListener('presence', (event) => {
        const next = parsePresence((event as MessageEvent<string>).data);
        if (next) setPresent(next);
      });
      source.addEventListener('error', () => {
        // While CONNECTING the browser retries itself; CLOSED (an error answer such as 401 or 404) needs a new stream.
        if (source?.readyState !== EventSource.CLOSED) return;
        joined = false;
        setPresent(NOBODY);
        reconnect = setTimeout(open, reconnectDelay(failures++));
      });
    }

    open();
    const heartbeat = setInterval(() => {
      refreshIdle();
      send(true);
    }, HEARTBEAT_MS);
    // The heartbeat notices five minutes without activity; this notices hiding and showing the tab at once.
    document.addEventListener('visibilitychange', refreshIdle);
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onActivity, { passive: true });
    sendChange.current = () => send();

    return () => {
      stopped = true;
      source?.close();
      clearTimeout(reconnect);
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', refreshIdle);
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity);
      sendChange.current = () => {};
      setPresent(NOBODY);
    };
  }, [familyId]);

  useEffect(() => {
    state.current = { viewing, editing };
    sendChange.current();
  }, [viewing, editing]);
}
