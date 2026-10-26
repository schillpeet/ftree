'use client';

import { useCallback, useEffect, useState } from 'react';

// Loads one admin list or total: null while loading, `failed` after an error, `reload` to load once more.
// With `refreshMs` it loads again in the background at that interval, keeping the shown data meanwhile.
export function useAdminLoad<T>(load: () => Promise<{ status: number; data: unknown }>, refreshMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    const fetchOnce = () =>
      load()
        .then((response) => {
          if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
          if (current) {
            setData(response.data as T);
            setFailed(false);
          }
        })
        .catch(() => {
          if (current) setFailed(true);
        });
    void fetchOnce();
    const timer = refreshMs ? window.setInterval(() => void fetchOnce(), refreshMs) : undefined;
    return () => {
      current = false;
      window.clearInterval(timer);
    };
  }, [load, refreshMs, attempt]);

  const reload = useCallback(() => {
    setFailed(false);
    setAttempt((value) => value + 1);
  }, []);

  return { data, failed, reload };
}
