import type { Metadata } from 'next';
import './globals.css';
import { LogoIcon } from './icons';

export const metadata: Metadata = {
  title: 'ftree',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer className="app-version glass">
          <LogoIcon />v{process.env.APP_VERSION}
        </footer>
      </body>
    </html>
  );
}
