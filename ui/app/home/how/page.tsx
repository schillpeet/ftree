import type { Metadata } from 'next';
import HowItWorks from '../HowItWorks';

export const metadata: Metadata = {
  title: 'ftree · So funktioniert’s',
};

// The three steps, under `/home` and public like the landing page.
export default function HowPage() {
  return <HowItWorks />;
}
