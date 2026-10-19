'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Member } from '../lib/api/generated/members';
import { SearchIcon } from './icons';
import { useT } from './i18n';
import { memberLabel, searchMembers } from './nameSearch';

type Props = {
  members: Member[];
  onSelect: (id: string) => void;
};

// A glass square next to the burger menu that widens to a search field with autocomplete.
export default function MemberSearch({ members, onSelect }: Props) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(() => searchMembers(members, query), [members, query]);
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0));

  function close() {
    setIsOpen(false);
    setQuery('');
    setActive(0);
  }

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen]);

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

  const showList = isOpen && query.trim() !== '';

  return (
    <div className="member-search" data-open={isOpen} ref={rootRef}>
      {isOpen ? (
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
      ) : (
        <button
          className="glass glass-button glass-icon"
          type="button"
          aria-label={t.search.open}
          onClick={() => setIsOpen(true)}
        >
          <SearchIcon />
        </button>
      )}
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
