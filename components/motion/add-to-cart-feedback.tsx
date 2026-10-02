"use client";

import { Check } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { useFly } from "@/lib/fly-store";

const POP = { type: "spring", stiffness: 520, damping: 30, mass: 0.7 } as const;

/** "Added" bubble shown after any add-to-order, above the tab bar. */
export function AddToCartFeedback() {
  const toast = useFly((s) => s.toast);
  const dismiss = useFly((s) => s.dismiss);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => dismiss(toast.id), 2400);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+12px)] z-[90] flex justify-center px-4 md:top-20 md:bottom-auto"
    >
      <AnimatePresence mode="popLayout">
        {toast ? (
          <motion.div
            key={toast.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.96, transition: { duration: 0.18 } }}
            transition={POP}
            className="flex items-center gap-2.5 rounded-full bg-surface-3/90 py-2 pr-4 pl-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.14),inset_0_0_0_1px_rgb(255_255_255/0.12),0_16px_40px_-12px_rgb(0_0_0/0.8)] backdrop-blur-2xl backdrop-saturate-150"
          >
            <motion.span
              initial={reduce ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...POP, delay: 0.08 }}
              className="grid size-7 place-items-center rounded-full bg-white text-black"
            >
              <Check className="size-4" strokeWidth={3} aria-hidden />
            </motion.span>
            <span className="text-sm font-semibold whitespace-nowrap">{toast.text}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
