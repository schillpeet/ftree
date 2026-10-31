import type { Metadata } from 'next';
import { connection } from 'next/server';
import { PermissionsProvider } from '../Permissions';
import AdminShell from './AdminShell';
import './admin.css';

export const metadata: Metadata = {
  title: 'ftree admin',
};

// A full page outside the tree's route group, so it has no scene; its own `/me` decides what it shows. On its own host
// it leads back to the app at `APP_URL`, read at request time like the operator.
export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  await connection();
  const appUrl = process.env.ADMIN_URL?.trim() ? process.env.APP_URL?.trim() || null : null;
  return (
    <PermissionsProvider>
      <div className="admin-page">
        <AdminShell appUrl={appUrl}>{children}</AdminShell>
      </div>
    </PermissionsProvider>
  );
}
