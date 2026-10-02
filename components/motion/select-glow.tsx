"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/** Soft light that blooms once when an option turns on. Parent needs `relative isolate overflow-hidden`. */
export function SelectGlow({ on }: { on: boolean }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <AnimatePresence initial={false}>
      {on ? (
        <motion.span
          key="glow"
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(90%_120%_at_50%_50%,rgb(255_255_255/0.3),transparent_70%)]"
          initial={{ opacity: 1, scale: 0.4 }}
          animate={{ opacity: 0, scale: 1.25 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      ) : null}
    </AnimatePresence>
  );
}
