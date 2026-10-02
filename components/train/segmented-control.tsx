"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export function TrainSegmentedControl({
  tab,
  onTabChange,
}: {
  tab: "memberships" | "pt";
  onTabChange: (tab: "memberships" | "pt") => void;
}) {
  return (
    <div className="flex gap-2 rounded-full bg-surface-3 p-1 sm:w-fit sm:mx-auto">
      <button
        type="button"
        onClick={() => onTabChange("memberships")}
        className={cn(
          "tap relative flex h-11 items-center rounded-full px-5 text-sm font-semibold transition-colors",
          tab === "memberships" ? "text-white" : "text-text-secondary hover:text-white",
        )}
      >
        Memberships
        {tab === "memberships" && (
          <motion.span
            layoutId="train-indicator"
            className="absolute inset-0 rounded-full bg-surface-2"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ zIndex: -1 }}
          />
        )}
      </button>
      <button
        type="button"
        onClick={() => onTabChange("pt")}
        className={cn(
          "tap relative flex h-11 items-center rounded-full px-5 text-sm font-semibold transition-colors",
          tab === "pt" ? "text-white" : "text-text-secondary hover:text-white",
        )}
      >
        Personal Training
        {tab === "pt" && (
          <motion.span
            layoutId="train-indicator"
            className="absolute inset-0 rounded-full bg-surface-2"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ zIndex: -1 }}
          />
        )}
      </button>
    </div>
  );
}
