import Link from 'next/link';

// The f-monogram of the prototype, in the accent colour.
const Monogram = () => (
  <svg className="header-monogram" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M15 27V13" />
    <path d="M15 17C10 17 7 14 7 9c5 0 8 3 8 8z" />
    <path d="M15 14c0-5 3-8 8-8 0 5-3 8-8 8z" />
    <path d="M9 27h12" />
  </svg>
);

// The wordmark of every header, leading to the landing page.
export default function BrandLink() {
  return (
    <Link className="header-brand" href="/home">
      <Monogram />
      <span className="header-wordmark">ftree</span>
    </Link>
  );
}
