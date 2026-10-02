"use client";

import { create } from "zustand";

export type Flight = { id: number; x: number; y: number; tint: string };

type FlyState = {
  flights: Flight[];
  launch: (from: DOMRect | { x: number; y: number }, tint: string) => void;
  land: (id: number) => void;
};

let seq = 0;

/** Launches the "item flies into the cart" animation from a screen point. */
export const useFly = create<FlyState>((set) => ({
  flights: [],
  launch: (from, tint) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const x = "width" in from ? from.x + from.width / 2 : from.x;
    const y = "height" in from ? from.y + from.height / 2 : from.y;
    set((s) => ({ flights: [...s.flights, { id: ++seq, x, y, tint }] }));
  },
  land: (id) => set((s) => ({ flights: s.flights.filter((f) => f.id !== id) })),
}));

export function haptic(ms = 12) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(ms);
}
