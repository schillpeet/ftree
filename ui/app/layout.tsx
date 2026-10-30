import type { Metadata } from 'next';
import './globals.css';
import { LogoIcon } from './icons';
import LegalLinks from './LegalLinks';

export const metadata: Metadata = {
  title: 'ftree',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>
        {/* `/me` is loaded by the tree's and the admin page's layouts, so `/terms` and `/privacy` need no BFF and no login. */}
        {children}
        <footer className="app-version glass">
          <LogoIcon />v{process.env.APP_VERSION}
          <LegalLinks />
        </footer>
      </body>
    </html>
  );
}
