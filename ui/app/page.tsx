import FamilyTree from './FamilyTree';
import { PermissionsProvider } from './Permissions';

export default function Home() {
  return (
    <PermissionsProvider>
      <FamilyTree />
    </PermissionsProvider>
  );
}
