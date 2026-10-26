import type { Metadata } from 'next';
import './globals.css';
import { LogoIcon } from './icons';
import { PermissionsProvider } from './Permissions';

export const metadata: Metadata = {
  title: 'ftree',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>
        {/* Here rather than in the tree's layout, so pages outside it (the admin page) share `/me`. */}
        <PermissionsProvider>{children}</PermissionsProvider>
        <footer className="app-version glass">
          <LogoIcon />v{process.env.APP_VERSION}
        </footer>
      </body>
    </html>
  );
}
