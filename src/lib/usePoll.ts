'use client';

import { useEffect, useRef } from 'react';

// Calls fn every `ms` while the page is visible. Hidden tab/app = no requests;
// coming back runs fn at once, then resumes. Restarts when `key` changes; null key = off.
// The caller does its own first fetch.
export function usePoll(fn: () => void, ms: number, key: unknown): void {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    if (key === null) return;
    let id: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      id = setInterval(() => fnRef.current(), ms);
    };
    const onVisibility = () => {
      clearInterval(id);
      if (document.hidden) return;
      fnRef.current();
      start();
    };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ms, key]);
}
