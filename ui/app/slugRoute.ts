// Every tree opens at `/<slug>`. Pure, so `slugRoute.check.mjs` can test it without Next.
import type { FamilySummary } from '../lib/api/generated/members';

type Family = Pick<FamilySummary, 'id' | 'name' | 'slug'>;

// First path segments that are routes of their own and therefore never name a tree; a family with such a slug could
// not be opened by its URL. `admin` is the admin page, `home` the public landing page, `start` the tree's entry, `terms`
// and `privacy` the legal pages, and `healthz` the probe, static routes that win over `[slug]`; the `/api` rewrite runs
// before dynamic routes; `cdn-cgi` is Cloudflare's.
// New families get random 10-character slugs (FamilySlugs.kt), which never match one of these.
export const RESERVED_SLUGS = ['admin', 'api', 'healthz', 'cdn-cgi', 'home', 'start', 'terms', 'privacy'] as const;

// The BFF's slug format: lowercase ASCII words joined by `-`.
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const isTreeSlug = (slug: string) => SLUG.test(slug) && !(RESERVED_SLUGS as readonly string[]).includes(slug);

// The family a URL segment names, or null for an unknown, invisible, reserved or malformed one.
export function familyOfSlug<F extends Family>(families: readonly F[], slug: string | undefined): F | null {
  if (slug === undefined || !isTreeSlug(slug)) return null;
  return families.find((family) => family.slug === slug) ?? null;
}

// The tree `/start` opens: the family named "default", else the first visible one.
export function firstFamily<F extends Family>(families: readonly F[]): F | null {
  return families.find((family) => family.name.toLocaleLowerCase() === 'default') ?? families[0] ?? null;
}

export const pathOf = (family: Pick<Family, 'slug'>) => `/${family.slug}`;

// Where `/start` leads once the families are known: the tree last open in this browser while it is still visible, else
// `firstFamily`; null keeps it (no family visible).
export function homePath(families: readonly Family[], lastSlug?: string | null): string | null {
  const family = familyOfSlug(families, lastSlug ?? undefined) ?? firstFamily(families);
  return family ? pathOf(family) : null;
}

// The switcher's entries: every visible family, by name, the open one marked.
export function switcherEntries(families: readonly Family[], activeId: string | null) {
  return [...families]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((family) => ({ id: family.id, name: family.name, href: pathOf(family), active: family.id === activeId }));
}

// What a blank start shows instead of an empty board: 'noTree' at `/start` while no tree is visible at all, 'noPeople' for an
// open tree without members, null otherwise (still loading, a failed load, or a tree with people).
export function emptyTreeOf(
  families: readonly Family[] | null,
  slug: string | undefined,
  active: Family | null,
  members: readonly unknown[] | null,
): 'noTree' | 'noPeople' | null {
  if (families?.length === 0 && slug === undefined) return 'noTree';
  if (active && members?.length === 0) return 'noPeople';
  return null;
}
