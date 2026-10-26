import type { Metadata } from 'next';
import './admin.css';

export const metadata: Metadata = {
  title: 'ftree admin',
};

// A full page outside the tree's route group, so it has no scene; the root layout's `/me` still decides what it shows.
export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return <div className="admin-page">{children}</div>;
}
