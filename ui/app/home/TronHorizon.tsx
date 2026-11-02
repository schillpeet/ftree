// The TRON landing's world behind the hero: a perspective floor grid running toward a glowing horizon, a faint mountain
// ridge, and a beam of light rising from the horizon that branches like a circuit into glowing nodes – a family tree of
// light. Only CSS shows it, under `[data-theme='tron']` (`landing.css`); it draws itself once and then pulses slowly.
// Reading pages (`/home/how`) leave the tree out, so it never stands behind text.
export default function TronHorizon({ dim = false, tree = true }: { dim?: boolean; tree?: boolean }) {
  return (
    <div className={`tron-horizon${dim ? ' landing-backdrop-dim' : ''}`} aria-hidden="true">
      <div className="tron-horizon-floor" />
      <svg className="tron-horizon-ridge" viewBox="0 0 680 47" preserveAspectRatio="none">
        <path d="M0 47V40L60 22l45 12 65-30 55 26 40-10 35 20h80l40-22 50 14 60-32 60 28 50-14 40 16v17z" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="tron-horizon-line" />
      {/* The light trail of the ride into the tree (`ride.ts`), hidden until then. */}
      <div className="tron-horizon-trail" />
      {tree && <div className="tron-horizon-reflection" />}
      {tree && (
        <svg className="tron-horizon-tree" viewBox="0 0 240 220">
          <defs>
            <filter id="tron-tree-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g filter="url(#tron-tree-glow)">
            <path className="tron-trunk" pathLength={1} d="M120 220V91" />
            <path className="tron-branch" pathLength={1} d="M120 131h32l20-20V93" />
            <path className="tron-branch" pathLength={1} d="M120 157H90l-18-18v-18" />
            <path className="tron-branch" pathLength={1} d="M120 91H50V65" />
            <path className="tron-branch" pathLength={1} d="M120 91h70V65" />
            <path className="tron-twig" pathLength={1} d="M50 65H16V39" />
            <path className="tron-twig" pathLength={1} d="M50 65h30V35" />
            <path className="tron-twig" pathLength={1} d="M190 65h-30V35" />
            <path className="tron-twig" pathLength={1} d="M190 65h36V39" />
            <path className="tron-twig" pathLength={1} d="M120 91V21" />
            <circle cx="16" cy="39" r="4.5" />
            <circle cx="80" cy="35" r="4.5" />
            <circle cx="160" cy="35" r="4.5" />
            <circle cx="226" cy="39" r="4.5" />
            <circle cx="120" cy="21" r="5.5" />
            <circle cx="172" cy="93" r="4" />
            <circle cx="72" cy="121" r="4" />
          </g>
        </svg>
      )}
    </div>
  );
}
