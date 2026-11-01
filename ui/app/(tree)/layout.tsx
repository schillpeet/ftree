import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { hostOf } from '../access';
import AdminViewBanner from '../AdminViewBanner';
import FamilyTree from '../FamilyTree';
import { operator } from '../operator';
import { PermissionsProvider } from '../Permissions';
import ThemeRoot from '../ThemeRoot';

// The scene lives in this layout, not in the pages, so switching between trees (`/` and `/<slug>`) keeps the canvas
// and only swaps the family; `FamilyTree` reads the slug itself. Routes outside this group, like `/admin`, have no scene.
// On the administration's own host (`ADMIN_URL`) a tree is an admin's view of it, which a banner says.
export default async function TreeLayout({ children }: { children: ReactNode }) {
  const { email } = await operator();
  const adminHost = hostOf(process.env.ADMIN_URL);
  const adminView = adminHost !== null && (await headers()).get('host')?.toLowerCase() === adminHost;
  return (
    <PermissionsProvider>
      <ThemeRoot />
      {adminView && <AdminViewBanner />}
      <FamilyTree operatorEmail={email} />
      {children}
    </PermissionsProvider>
  );
}
