'use client';

import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createFamilyMember, uploadFamilyMemberPhoto, type CreateMemberRequest, type Member } from '../lib/api/generated/members';
import { useT } from './i18n';
import { splitName } from './names';
import { CENTRE, clampOffset, placeBeside, type Offset } from './panelPosition';
import { Avatar, PanelShell } from './PersonPanel';
import RelationLink from './RelationLink';

export type MemberForm = {
  firstName: string;
  lastName: string;
  birthName: string;
  birthDate: string;
  birthPlace: string;
  deathDate: string;
  deathPlace: string;
  note: string;
};

export const EMPTY_FORM: MemberForm = {
  firstName: '',
  lastName: '',
  birthName: '',
  birthDate: '',
  birthPlace: '',
  deathDate: '',
  deathPlace: '',
  note: '',
};

export const toForm = (member: Member): MemberForm => ({
  firstName: member.firstName,
  lastName: member.lastName,
  birthName: member.birthName ?? '',
  birthDate: member.birthDate ?? '',
  birthPlace: member.birthPlace ?? '',
  deathDate: member.deathDate ?? '',
  deathPlace: member.deathPlace ?? '',
  note: member.note ?? '',
});

export const toRequest = (form: MemberForm, photoUrl: string | null): CreateMemberRequest => ({
  firstName: form.firstName.trim(),
  lastName: form.lastName.trim(),
  birthName: form.birthName.trim() || null,
  birthDate: form.birthDate || null,
  birthPlace: form.birthPlace.trim() || null,
  deathDate: form.deathDate || null,
  deathPlace: form.deathPlace.trim() || null,
  note: form.note.trim() || null,
  photoUrl,
});

// Scales the picked image down to at most 800 px on the longer edge and re-encodes it as JPEG,
// which keeps uploads well below the BFF's 2 MB limit.
export async function toJpeg(file: File) {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 800 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#fff'; // JPEG has no transparency
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image encoding failed'))), 'image/jpeg', 0.85),
  );
}

// A picked file as an object URL for the avatar, revoked once it is replaced.
export function usePhotoPreview(file: File | null) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);
  return preview;
}

type Update = (field: keyof MemberForm, value: string) => void;

// Top of the form: the photo (click or drop an image) beside first name, last name, and the optional birth name.
// children go below the name fields, e.g. the button that removes a stored photo.
export function MemberHero({
  form,
  onChange,
  photo,
  onPhoto,
  showBirthName,
  onShowBirthName,
  children,
}: {
  form: MemberForm;
  onChange: Update;
  photo: string | null;
  onPhoto: (file: File | null) => void;
  showBirthName: boolean;
  onShowBirthName: () => void;
  children?: ReactNode;
}) {
  const t = useT();
  const [isDragging, setIsDragging] = useState(false);
  return (
    <div className="person-hero person-hero-edit">
      {/* Dropping an image on the avatar picks it like the file chooser does. */}
      <label
        className={`person-photo-drop${isDragging ? ' person-photo-drop-active' : ''}`}
        title={t.members.dropPhoto}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const file = event.dataTransfer.files[0];
          if (file?.type.startsWith('image/')) onPhoto(file);
        }}
      >
        <Avatar member={form} photo={photo} large />
        <span>{t.members.changePhoto}</span>
        <input type="file" accept="image/*" onChange={(event) => onPhoto(event.target.files?.[0] ?? null)} />
      </label>
      <div className="person-name-fields">
        <label className="person-field">
          {t.members.firstName}
          <input
            autoFocus
            autoComplete="given-name"
            maxLength={100}
            value={form.firstName}
            onChange={(event) => onChange('firstName', event.target.value)}
          />
        </label>
        <label className="person-field">
          {t.members.lastName}
          <input
            autoComplete="family-name"
            maxLength={100}
            value={form.lastName}
            onChange={(event) => onChange('lastName', event.target.value)}
          />
        </label>
        {showBirthName ? (
          <label className="person-field">
            {t.members.birthName}
            <input maxLength={100} value={form.birthName} onChange={(event) => onChange('birthName', event.target.value)} />
          </label>
        ) : (
          <button type="button" className="person-link-button" onClick={onShowBirthName}>
            + {t.members.addBirthName}
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

// Birth and death in two columns, then the note.
export function MemberLifeFields({ form, onChange }: { form: MemberForm; onChange: Update }) {
  const t = useT();
  return (
    <>
      <div className="person-fields">
        <label className="person-field">
          {t.members.birthDate}
          <input type="date" value={form.birthDate} onChange={(event) => onChange('birthDate', event.target.value)} />
        </label>
        <label className="person-field">
          {t.members.birthPlace}
          <input maxLength={200} value={form.birthPlace} onChange={(event) => onChange('birthPlace', event.target.value)} />
        </label>
        <label className="person-field">
          {t.members.deathDate}
          <input type="date" value={form.deathDate} onChange={(event) => onChange('deathDate', event.target.value)} />
        </label>
        <label className="person-field">
          {t.members.deathPlace}
          <input maxLength={200} value={form.deathPlace} onChange={(event) => onChange('deathPlace', event.target.value)} />
        </label>
      </div>
      <label className="person-field">
        {t.members.note}
        <textarea maxLength={5000} value={form.note} onChange={(event) => onChange('note', event.target.value)} />
      </label>
    </>
  );
}

// The panel that creates a relative is narrower than the person panel, so the two fit side by side.
const NEW_MEMBER_WIDTH = 480;
// The person panel's top edge without an offset (`.person-panel` in globals.css).
const PANEL_TOP = 104;

// Opened from the relatives search when nobody matches: creates the person right away, prefilled with the
// typed name, and hands them back so the edited person's form can assign them. Relatives are left to that form.
// It opens beside the panel it came from (anchor), on the side with more room, moving that panel over by
// onShiftAnchor when it is not pinned; a line from the "… hinzufügen" button (linkFrom) leads to it.
export function NewMemberPanel({
  familyId,
  name,
  title,
  anchor,
  anchorPinned,
  onShiftAnchor,
  linkFrom,
  onCreated,
  onClose,
}: {
  familyId: string;
  name: string;
  title: string;
  anchor: () => Element | null;
  anchorPinned: boolean;
  onShiftAnchor: (dx: number) => void;
  linkFrom: () => Element | null;
  onCreated: (member: Member, photoFailed: boolean) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState<MemberForm>(() => ({ ...EMPTY_FORM, ...splitName(name) }));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [showBirthName, setShowBirthName] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const photoPreview = usePhotoPreview(photoFile);

  // Placed from the first render on, so it never flashes up in the middle; the panel it came from is already shown.
  const [placement] = useState(() => {
    const rect = anchor()?.getBoundingClientRect();
    if (!rect) return { offset: CENTRE, shift: 0 };
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const width = Math.min(NEW_MEMBER_WIDTH, viewport.width - 32);
    const { shift, left } = placeBeside(rect, width, viewport, !anchorPinned);
    const box = { left: (viewport.width - width) / 2, top: PANEL_TOP, width };
    return { offset: clampOffset({ x: left - box.left, y: rect.top - PANEL_TOP }, box, viewport), shift };
  });
  const [offset, setOffset] = useState<Offset>(placement.offset);
  // Once, also when development mode runs effects twice.
  const shifted = useRef(false);
  const shiftAnchor = useEffectEvent(() => {
    if (placement.shift && !shifted.current) onShiftAnchor(placement.shift);
    shifted.current = true;
  });
  useLayoutEffect(() => shiftAnchor(), []);
  const findSelf = useCallback(() => document.querySelector('.person-panel-new'), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const response = await createFamilyMember(familyId, toRequest(form, null));
      if (response.status !== 201) {
        setError(t.members.createFailed);
        return;
      }
      let saved = response.data;
      let photoFailed = false;
      if (photoFile) {
        try {
          const upload = await uploadFamilyMemberPhoto(familyId, saved.id, await toJpeg(photoFile));
          if (upload.status !== 204) throw new Error('Unexpected photo response');
          saved = { ...saved, photoUpdatedAt: new Date().toISOString() };
        } catch {
          photoFailed = true;
        }
      }
      onCreated(saved, photoFailed);
    } catch {
      setError(t.members.unreachable);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <RelationLink from={linkFrom} to={findSelf} />
      <PanelShell
        className="person-panel-new"
        label={title}
        closeLabel={t.members.closeForm}
        onClose={() => {
          if (!isSaving) onClose();
        }}
        offset={offset}
        onMove={setOffset}
        pinned={pinned}
        onPinnedChange={setPinned}
      >
        <form className="person-form" onSubmit={submit}>
          <MemberHero
            form={form}
            onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))}
            photo={photoPreview}
            onPhoto={setPhotoFile}
            showBirthName={showBirthName}
            onShowBirthName={() => setShowBirthName(true)}
          />
          <MemberLifeFields form={form} onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))} />
          {error && <p className="person-error" role="alert">{error}</p>}
          <div className="person-footer">
            <button type="button" disabled={isSaving} onClick={onClose}>
              {t.members.discard}
            </button>
            <button type="submit" className="person-primary" disabled={isSaving}>
              {isSaving ? t.saving : t.members.save}
            </button>
          </div>
        </form>
      </PanelShell>
    </>
  );
}
