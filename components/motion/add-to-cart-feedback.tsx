"use client";

import { Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

type Props = {
  itemName: string;
  isVisible: boolean;
  onDismiss: () => void;
};

export function AddToCartFeedback({ itemName, isVisible, onDismiss }: Props) {
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!isVisible) return;
    setKey((k) => k + 1);
    const timer = setTimeout(onDismiss, 2200);
    return () => clearTimeout(timer);
  }, [isVisible, onDismiss]);

  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          key={key}
          initial={{ scale: 0.6, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: -10 }}
          transition={{ type: "spring", stiffness: 400, damping: 25, mass: 0.6 }}
          className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2"
        >
          <div className="flex items-center gap-3 rounded-full bg-surface-2 px-5 py-3 shadow-lg ring-1 ring-hairline-strong backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 20, delay: 0.1 }}
              className="flex size-6 items-center justify-center rounded-full bg-yellow"
            >
              <Check className="size-4 stroke-[3] text-black" aria-hidden />
            </motion.div>
            <span className="text-sm font-semibold text-foreground">
              {itemName} added
            </span>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
