'use client';

import { APPEARANCES, useAppearance, type Appearance } from '../appearance';
import { AdminBadge, EvolutionButton } from '../Header';
import { useT } from '../i18n';
import { useState } from 'react';
import { hasDevTools, useSignedIn } from './signedIn';

// What the public headers show beside the brand for a signed-in person: the Evolution button for holders of the developer
// tools and the admin badge for admins. There is no tree here, so the panel only has the view lab; the tools for time,
// camera, lines, and preview wait in a tree.
export default function HomeEvolution() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [appearance, setAppearance] = useAppearance();
  const me = useSignedIn();
  return (
    <>
      {hasDevTools(me) && <EvolutionButton open={open} onClick={() => setOpen(!open)} />}
      {me?.admin && <AdminBadge />}
      {open && hasDevTools(me) && (
        <section className="glass debug-panel" id="evolution-panel" aria-label={t.tools.evolution}>
          <div className="debug-panel-body">
            <section>
              <h2>{t.tools.viewLab}</h2>
              <label className="debug-row">
                <span>{t.tools.appearance}</span>
                <select value={appearance} onChange={(event) => setAppearance(event.target.value as Appearance)}>
                  {APPEARANCES.map((option) => (
                    <option key={option} value={option}>{t.tools.appearances[option]}</option>
                  ))}
                </select>
              </label>
              <p className="debug-hint">{t.tools.labHint}</p>
            </section>
          </div>
        </section>
      )}
    </>
  );
}
