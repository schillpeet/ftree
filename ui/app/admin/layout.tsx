import type { Metadata } from 'next';
import { PermissionsProvider } from '../Permissions';
import AdminShell from './AdminShell';
import './admin.css';

export const metadata: Metadata = {
  title: 'ftree admin',
};

// A full page outside the tree's route group, so it has no scene; its own `/me` decides what it shows.
export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <PermissionsProvider>
      <div className="admin-page">
        <AdminShell>{children}</AdminShell>
      </div>
    </PermissionsProvider>
  );
}
