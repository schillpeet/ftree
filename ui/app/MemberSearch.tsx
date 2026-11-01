'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Member } from '../lib/api/generated/members';
import { SearchIcon } from './icons';
import { useT } from './i18n';
import { memberLabel, searchMembers } from './nameSearch';

type Props = {
  members: Member[];
  // Opened and closed from outside (the dock's "Suchen"); the search closes itself by calling `onClose`.
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
};

// A glass search field with autocomplete, shown above the dock while open. The field is unmounted while closed, so
// every opening starts with an empty query.
export default function MemberSearch({ open, ...props }: Props) {
  return open ? <SearchField {...props} /> : null;
}

function SearchField({ members, onClose, onSelect }: Omit<Props, 'open'>) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(() => searchMembers(members, query), [members, query]);
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0));

  function close() {
    setQuery('');
    setActive(0);
    onClose();
  }

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element;
      // The dock's own buttons decide (its "Suchen" toggles), so a press there is not an outside press.
      if (!rootRef.current?.contains(target) && !target.closest('[data-dock]')) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `close` only resets state and calls the current `onClose`.
  }, []);

  function choose(member: Member) {
    close();
    onSelect(member.id);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      close();
    } else if (event.key === 'ArrowDown' && results.length > 0) {
      event.preventDefault();
      setActive((activeIndex + 1) % results.length);
    } else if (event.key === 'ArrowUp' && results.length > 0) {
      event.preventDefault();
      setActive((activeIndex - 1 + results.length) % results.length);
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      choose(results[activeIndex]);
    }
  }

  const showList = query.trim() !== '';

  return (
    <div className="member-search" data-open="true" ref={rootRef}>
      <div className="glass member-search-field">
          <SearchIcon />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={showList && results.length > 0}
            aria-controls={listId}
            aria-activedescendant={showList && results[activeIndex] ? `${listId}-${activeIndex}` : undefined}
            aria-autocomplete="list"
            aria-label={t.search.label}
            placeholder={t.search.placeholder}
            autoComplete="off"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
      </div>
      {showList && (
        <ul className="glass member-search-list" id={listId} role="listbox" aria-label={t.search.label}>
          {results.length === 0 ? (
            <li className="member-search-empty">{t.search.noResults}</li>
          ) : (
            results.map((member, index) => (
              <li
                key={member.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onPointerEnter={() => setActive(index)}
                onClick={() => choose(member)}
              >
                {memberLabel(member)}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
