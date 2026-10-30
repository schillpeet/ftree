import type { ReactNode } from 'react';
import FamilyTree from '../FamilyTree';
import { operator } from '../operator';
import { PermissionsProvider } from '../Permissions';

// The scene lives in this layout, not in the pages, so switching between trees (`/` and `/<slug>`) keeps the canvas
// and only swaps the family; `FamilyTree` reads the slug itself. Routes outside this group, like `/admin`, have no scene.
export default async function TreeLayout({ children }: { children: ReactNode }) {
  const { email } = await operator();
  return (
    <PermissionsProvider>
      <FamilyTree operatorEmail={email} />
      {children}
    </PermissionsProvider>
  );
}
