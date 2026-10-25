'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getMe, type Me, type Permission } from '../lib/api/generated/members';
import { useT } from './i18n';
import { CloseIcon } from './icons';
import { authProblemOf, can, type AuthProblem } from './access';

// undefined while `/me` is loading, null when it failed.
const MeContext = createContext<Me | null | undefined>(undefined);

// Loads `/me` once; until it answers (or when it fails) nothing beyond viewing is shown.
// It also notices 401/403 answers of any API call and explains them in a small banner.
export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [problem, setProblem] = useState<AuthProblem | null>(null);

  useEffect(() => {
    // The generated client calls the global fetch, so watching it here covers every call
    // without changing the call sites; the response itself is passed on untouched.
    const original = window.fetch;
    window.fetch = async (input, init) => {
      const response = await original(input, init);
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const found = authProblemOf(url, response.status, window.location.origin);
      if (found) setProblem(found);
      return response;
    };
    let current = true;
    getMe()
      .then((response) => {
        if (current) setMe(response.status === 200 ? response.data : null);
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
      {children}
      {problem && <AuthNotice problem={problem} onClose={() => setProblem(null)} />}
    </MeContext>
  );
}

export const useMe = () => useContext(MeContext) ?? null;

// Whether `/me` has answered (successfully or not).
export const useMeLoaded = () => useContext(MeContext) !== undefined;

export const useCan = (permission: Permission) => can(useMe(), permission);

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
