'use client';

import { useT } from '../i18n';
import { CloseIcon } from '../icons';
import { whoOf } from './liveEvents';
import './presence.css';

// Under the presence bar while the camera follows someone, with a button that stops it.
export default function FollowChip({ email, onStop }: { email: string; onStop: () => void }) {
  const t = useT();
  return (
    <div className="glass presence-follow-chip" role="status">
      <span>{t.presence.following(whoOf(email))}</span>
      <button type="button" className="presence-follow-stop" onClick={onStop} aria-label={t.presence.stopFollowing}>
        <CloseIcon />
      </button>
    </div>
  );
}
