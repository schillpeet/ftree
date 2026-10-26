'use client';

import { useEffect, useRef } from 'react';
import { useT } from './i18n';
import './conflict.css';

// Shown when someone else saved the person while this form was open.
export default function ConflictDialog({
  busy,
  onReload,
  onOverwrite,
  onCancel,
}: {
  busy: boolean;
  onReload: () => void;
  onOverwrite: () => void;
  onCancel: () => void;
}) {
  const t = useT().conflict;
  const reload = useRef<HTMLButtonElement>(null);

  useEffect(() => reload.current?.focus(), []);

  return (
    <div className="conflict-backdrop" onKeyDown={(event) => event.key === 'Escape' && !busy && onCancel()}>
      <div className="glass conflict-dialog" role="alertdialog" aria-modal="true" aria-labelledby="conflict-title" aria-describedby="conflict-text">
        <h2 id="conflict-title">{t.title}</h2>
        <p id="conflict-text">{t.text}</p>
        <div className="conflict-actions">
          <button type="button" disabled={busy} onClick={onCancel}>
            {t.cancel}
          </button>
          <button type="button" className="conflict-overwrite" disabled={busy} onClick={onOverwrite}>
            {t.overwrite}
          </button>
          <button type="button" className="conflict-reload" ref={reload} disabled={busy} onClick={onReload}>
            {t.reload}
          </button>
        </div>
      </div>
    </div>
  );
}
