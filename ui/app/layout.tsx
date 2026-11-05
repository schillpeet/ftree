import type { Metadata } from 'next';
import './tokens.css';
import './globals.css';
import { fontVariables } from './fonts';
import LegalLinks from './LegalLinks';

// The end of a ride into a tree (`ride.ts`): before the first paint, so the server-rendered header and dock never flash up;
// the scene takes over with `.riding-in` and removes the style once the camera has arrived, and the timeout frees the
// page if it never does. A style of its own, as React owns `<html>`'s attributes; here in the root layout, as React
// never renders it again on the client, where a `<script>` would not run.
const RIDE_PENDING = `try{if(Date.now()-Number(sessionStorage.getItem('ftree.ride'))<15000){var s=document.createElement('style');s.id='ride-pending';s.textContent='.app-header,.dock-root,.app-version,.relation-legend,.presence-bar,.presence-hint,.admin-view-banner{visibility:hidden}';document.head.appendChild(s);setTimeout(function(){s.remove()},6000)}}catch(e){}`;

export const metadata: Metadata = {
  title: 'ftree',
  // For the test phase: nothing here belongs in a search engine, and page metadata inherits this.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // The app brings its own German and English texts; browser translation would mangle them (`Organic tree` → `Biobaum`).
    <html lang="en" translate="no" data-theme="3d" data-motion="off" className={fontVariables}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: RIDE_PENDING }} />
      </head>
      <body>
        {/* `/me` is loaded by the tree's and the admin page's layouts, so `/terms`, `/privacy`, and `/imprint` need no login. */}
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
