"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** true once on the client; avoids hydration mismatches for persisted state */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
