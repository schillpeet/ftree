'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { MoreIcon } from '../icons';

export type MenuAction = {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  hidden?: boolean;
  onSelect: () => void;
};

// The "⋯" button of a card: the rarer actions wait in a small menu, so a card shows one obvious action at most.
// Escape, a press outside, or choosing an entry closes it.
export default function ActionMenu({ label, actions, disabled }: { label: string; actions: readonly MenuAction[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const shown = actions.filter((action) => !action.hidden);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  if (shown.length === 0) return null;
  return (
    <div className="admin-menu" ref={root}>
      <button
        type="button"
        className="family-card-button admin-icon-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <MoreIcon />
      </button>
      {open && (
        <div className="glass admin-menu-list" role="menu" id={id}>
          {shown.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              className={action.danger ? 'admin-menu-item admin-menu-danger' : 'admin-menu-item'}
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
