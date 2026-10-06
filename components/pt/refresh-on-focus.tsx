"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * "Push" without push notifications: when the app comes back to the foreground (or every
 * couple of minutes while open) it refetches, so a coach's update shows up straight away.
 */
export function RefreshOnFocus({ every = 120_000 }: { every?: number }) {
  const router = useRouter();
  const last = useRef(Date.now());
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - last.current < 5_000) return;
      last.current = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, every);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      clearInterval(timer);
    };
  }, [router, every]);
  return null;
}
