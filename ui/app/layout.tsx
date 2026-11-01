import type { Metadata } from 'next';
import './tokens.css';
import './globals.css';
import { fontVariables } from './fonts';
import LegalLinks from './LegalLinks';

export const metadata: Metadata = {
  title: 'ftree',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // The app brings its own German and English texts; browser translation would mangle them (`Organic tree` → `Biobaum`).
    <html lang="en" translate="no" data-theme="3d" className={fontVariables}>
      <body>
        {/* `/me` is loaded by the tree's and the admin page's layouts, so `/terms` and `/privacy` need no BFF and no login. */}
        {children}
        <footer className="app-version">
          v{process.env.APP_VERSION}
          <span aria-hidden="true">·</span>
          <LegalLinks />
        </footer>
      </body>
    </html>
  );
}
