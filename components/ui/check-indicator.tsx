"use client";

import { Check } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const POP = { type: "spring", stiffness: 560, damping: 28 } as const;

/** White check that pops in when a glass choice is selected. */
export function CheckIndicator({ on, className }: { on: boolean; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full transition-[background-color,box-shadow] duration-200",
        on ? "bg-white text-black shadow-[0_0_14px_rgb(255_255_255/0.45)]" : "shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.28)]",
        className,
      )}
    >
      <AnimatePresence initial={false}>
        {on ? (
          <motion.span
            key="check"
            initial={reduce ? false : { scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={reduce ? undefined : { scale: 0, transition: { duration: 0.1 } }}
            transition={POP}
          >
            <Check className="size-3" strokeWidth={3.5} />
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
