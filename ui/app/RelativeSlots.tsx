'use client';

import { useState, type ReactNode } from 'react';
import { Html } from '@react-three/drei';
import type { Member } from '../lib/api/generated/members';
import { useT } from './i18n';
import { PencilIcon } from './icons';
import { nameOf } from './names';
import { CARD, type Point } from './pins';
import QuickAdd from './QuickAdd';
import { missingSlots, type SlotKind } from './slots';
import './slots.css';

// Above every label of the scene: drei's Html stacks by distance within [16777271, 0] unless told otherwise.
const ABOVE_LABELS: [number, number] = [16777273, 16777272];

// Where a scene draws the slots: around the card of `memberId`, given that card's position and the scale of its labels.
export type SlotMount = { memberId: string; render: (position: Point, distanceFactor: number) => ReactNode };

// The dashed "+" slots around the selected person, only for relations still missing (`slots.ts`). A slot opens the
// quick-add popover; after a mother it moves on to the father. `card` is the shape they surround: the hanging card in
// 3D (its top edge at `position`, facing the camera) or the TRON label (centred on `position`). drei's Html renders in
// another React root without context, so everything comes in as props; only callers allowed to edit mount it. The pencil
// on the left opens the person's edit form, like the pencil in the person panel.
export default function RelativeSlots({
  member,
  familyId,
  position,
  card,
  distanceFactor,
  onAdded,
  onEdit,
}: {
  member: Member;
  familyId: string;
  position: Point;
  card: 'scroll' | 'pill';
  distanceFactor: number;
  onAdded: (added: Member) => void;
  onEdit?: (id: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState<{ kind: SlotKind; anchor: DOMRect; key: number } | null>(null);
  const kinds = missingSlots(member);
  const slot = (kind: SlotKind) => (
    <button
      key={kind}
      type="button"
      className={open?.kind === kind ? 'relative-slot is-open' : 'relative-slot'}
      aria-haspopup="dialog"
      // Clicking a slot keeps the person panel, and with it the selection, open.
      data-keeps-panel
      aria-expanded={open?.kind === kind}
      // A press on a slot is not the start of a camera drag.
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => setOpen({ kind, anchor: event.currentTarget.getBoundingClientRect(), key: (open?.key ?? 0) + 1 })}
    >
      {t.slots.kind[kind]}
    </button>
  );
  const parents = kinds.filter((kind) => kind === 'mother' || kind === 'father' || kind === 'parent');
  // A `transform` Html shows a CSS pixel as distanceFactor / 400 world units.
  const box =
    card === 'scroll' ? { width: (CARD.width * 400) / distanceFactor, height: (CARD.height * 400) / distanceFactor } : { width: 0, height: 0 };

  return (
    <Html
      position={position}
      {...(card === 'scroll' ? { transform: true, sprite: true } : { center: true })}
      distanceFactor={distanceFactor}
      zIndexRange={ABOVE_LABELS}
    >
      <div
        className={`relative-slots relative-slots-${card}`}
        style={box}
        role="group"
        aria-label={t.slots.label(nameOf(member, t.members.unknown))}
      >
        {parents.length > 0 && <div className="relative-slots-parents">{parents.map(slot)}</div>}
        {kinds.includes('partner') && <div className="relative-slots-partner">{slot('partner')}</div>}
        {kinds.includes('child') && <div className="relative-slots-child">{slot('child')}</div>}
        {onEdit && (
          <div className="relative-slots-edit">
            <button
              type="button"
              className="relative-slot relative-slot-edit"
              aria-label={t.slots.edit(nameOf(member, t.members.unknown))}
              title={t.slots.edit(nameOf(member, t.members.unknown))}
              data-keeps-panel
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onEdit(member.id)}
            >
              <PencilIcon />
            </button>
          </div>
        )}
      </div>
      {/* Inside the Html, whose React DOM root can portal it into the body. */}
      {open && (
        <QuickAdd
          key={open.key}
          kind={open.kind}
          member={member}
          familyId={familyId}
          anchor={open.anchor}
          onClose={() => setOpen(null)}
          onSaved={(added, next) => {
            onAdded(added);
            setOpen(next ? { ...open, kind: next, key: open.key + 1 } : null);
          }}
        />
      )}
    </Html>
  );
}
