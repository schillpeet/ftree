'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { Member } from '../../lib/api/generated/members';
import { useT } from '../i18n';
import { nameOf } from '../names';
import { useMe } from '../Permissions';
import { onLiveEvent } from './liveBus';
import { toastOf, type LiveToast } from './liveEvents';
import './live.css';

// How long a toast stays, and how many are shown at once (the oldest make room).
const TOAST_MS = 6_000;
const MAX_TOASTS = 3;

// Tells who else saved a change in the open tree. `editingId` is the person whose form is open here: when someone
// else changes that person, the toast adds that saving will ask how to resolve the conflict.
export default function LiveToasts({ members, editingId }: { members: Member[]; editingId: string | null }) {
  const t = useT();
  const me = useMe();
  const [toasts, setToasts] = useState<(LiveToast & { key: number })[]>([]);
  const nextKey = useRef(0);

  // Read at the time of the event, before the members are loaded again, so a deleted person still has a name.
  const onEvent = useEffectEvent((event: Parameters<typeof toastOf>[0]) => {
    const name = (id: string) => {
      const member = members.find((m) => m.id === id);
      return member ? nameOf(member, t.live.unknownPerson) : t.live.unknownPerson;
    };
    const toast = toastOf(event, me?.email, name, editingId);
    if (!toast) return;
    const key = nextKey.current++;
    setToasts((current) => [...current, { ...toast, key }].slice(-MAX_TOASTS));
    setTimeout(() => setToasts((current) => current.filter((item) => item.key !== key)), TOAST_MS);
  });
  useEffect(() => onLiveEvent(onEvent), []);

  if (toasts.length === 0) return null;
  return (
    <ul className="live-toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <li key={toast.key} className="glass live-toast" onClick={() => setToasts((current) => current.filter((item) => item.key !== toast.key))} title={t.live.dismiss}>
          <span>
            {toast.kind === 'family-changed'
              ? t.live.family(toast.who)
              : toast.kind === 'member-deleted'
                ? t.live.deleted(toast.who, toast.name ?? '')
                : t.live.changed(toast.who, toast.name ?? '')}
          </span>
          {toast.conflict && <span className="live-toast-hint">{t.live.conflict}</span>}
        </li>
      ))}
    </ul>
  );
}
