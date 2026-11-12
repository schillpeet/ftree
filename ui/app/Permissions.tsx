'use client';

import { createContext, Fragment, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getMe, type FamilySummary, type Me, type Permission } from '../lib/api/generated/members';
import { useT } from './i18n';
import { CloseIcon } from './icons';
import LegalGate from './LegalGate';
import { authProblemOf, can, failedCallNeedsProbe, signedOutByProbe, type AuthProblem } from './access';
import { responseProblemCode } from './problems';

// undefined while `/me` is loading, null when it failed.
const MeContext = createContext<Me | null | undefined>(undefined);

// Replaces the loaded `/me` after the person changed something about themselves (the name), so every view updates.
const SetMeContext = createContext<(me: Me) => void>(() => {});

// The family that is open; its permissions are the caller's role in it.
const OpenFamilyContext = createContext<FamilySummary | null>(null);

export function OpenFamily({ family, children }: { family: FamilySummary | null; children: ReactNode }) {
  return <OpenFamilyContext value={family}>{children}</OpenFamilyContext>;
}

// Loads `/me` once; until it answers (or when it fails) nothing beyond viewing is shown.
// It also notices 401/403 answers of any API call, and an ended Access session behind a failed one, and explains them
// in a small banner.
export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [problem, setProblem] = useState<AuthProblem | null>(null);
  // Bumped once when the documents open at page load are accepted: what the page tried to load meanwhile was refused, so it
  // starts over. Documents that open later leave the page alone, so a form in progress stays and can be saved again.
  const [loadAttempt, setLoadAttempt] = useState(0);
  const blockedAtLoad = useRef(false);
  const accepted = useCallback((next: Me) => {
    setMe(next);
    if (blockedAtLoad.current && next.pendingLegal.length === 0) {
      blockedAtLoad.current = false;
      setLoadAttempt((value) => value + 1);
    }
  }, []);

  useEffect(() => {
    // The generated client calls the global fetch, so watching it here covers every call
    // without changing the call sites; the response itself is passed on untouched.
    const original = window.fetch;
    let probing = false;
    const probe = () => {
      if (probing) return;
      probing = true;
      void original('/api/me', { redirect: 'manual', cache: 'no-store' })
        .then((answer) => {
          if (signedOutByProbe(answer.type)) setProblem('signedOut');
        })
        .catch(() => {})
        .finally(() => {
          probing = false;
        });
    };
    let refreshing = false;
    const refreshMe = () => {
      if (refreshing) return;
      refreshing = true;
      void original('/api/me', { cache: 'no-store' })
        .then((answer) => (answer.ok ? (answer.json() as Promise<Me>) : null))
        .then((body) => {
          if (body) setMe(body);
        })
        .catch(() => {})
        .finally(() => {
          refreshing = false;
        });
    };
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      let response: Response;
      try {
        response = await original(input, init);
      } catch (error) {
        if (failedCallNeedsProbe(url, window.location.origin)) probe();
        throw error;
      }
      if (response.ok) return response;
      void responseProblemCode(response).then((code) => {
        // Documents took effect since `/me` was read: the card comes up over whatever is on the page.
        if (code === 'LEGAL_ACCEPTANCE_REQUIRED') refreshMe();
        const found = authProblemOf(url, response.status, code, window.location.origin);
        if (found) setProblem(found);
      });
      return response;
    };
    let current = true;
    getMe()
      .then((response) => {
        if (!current) return;
        setMe(response.status === 200 ? response.data : null);
        if (response.status === 200 && response.data.pendingLegal.length > 0) blockedAtLoad.current = true;
      })
      .catch(() => {
        if (current) setMe(null);
      });
    return () => {
      current = false;
      window.fetch = original;
    };
  }, []);

  return (
    <MeContext value={me}>
      <SetMeContext value={setMe}>
        <Fragment key={loadAttempt}>{children}</Fragment>
        <LegalGate me={me} onAccepted={accepted} />
        {problem && <AuthNotice problem={problem} onClose={() => setProblem(null)} />}
      </SetMeContext>
    </MeContext>
  );
}

// The landing page knows the person from its own quiet probe (`home/signedIn.ts`); this hands it to the boards it opens,
// without the provider's fetch watcher, auth banner, and acceptance card (the landing page shows its own).
export function KnownMe({ me, onMe, children }: { me: Me | null | undefined; onMe: (me: Me) => void; children: ReactNode }) {
  return (
    <MeContext value={me}>
      <SetMeContext value={onMe}>{children}</SetMeContext>
    </MeContext>
  );
}

export const useSetMe = () => useContext(SetMeContext);

export const useMe = () => useContext(MeContext) ?? null;

// Whether `/me` has answered (successfully or not).
export const useMeLoaded = () => useContext(MeContext) !== undefined;

// Outside any family, or in the open one.
export const useCan = (permission: Permission) => can(useMe(), permission, useContext(OpenFamilyContext));

export function Can({ permission, children }: { permission: Permission; children: ReactNode }) {
  return useCan(permission) ? children : null;
}

function AuthNotice({ problem, onClose }: { problem: AuthProblem; onClose: () => void }) {
  const t = useT();
  return (
    <div className="glass auth-notice" role="alert">
      <p>{problem === 'forbidden' ? t.auth.forbidden : t.auth.signedOut}</p>
      {problem === 'signedOut' && (
        <button type="button" className="auth-notice-action" onClick={() => window.location.reload()}>
          {t.auth.reload}
        </button>
      )}
      <button type="button" className="auth-notice-close" aria-label={t.auth.close} onClick={onClose}>
        <CloseIcon />
      </button>
    </div>
  );
}
