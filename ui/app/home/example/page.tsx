import type { Metadata } from 'next';
import ExampleTree from '../ExampleTree';

export const metadata: Metadata = {
  title: 'ftree · Beispielfamilie',
};

// The read-only example tree, under `/home` and behind Cloudflare Access like the landing page.
export default function ExamplePage() {
  return <ExampleTree />;
}
