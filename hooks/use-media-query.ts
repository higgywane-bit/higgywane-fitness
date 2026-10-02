"use client";

import { useCallback, useSyncExternalStore } from "react";

export function useMediaQuery(query: string, serverFallback = false) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverFallback,
  );
}

export const DESKTOP_QUERY = "(min-width: 768px)";
