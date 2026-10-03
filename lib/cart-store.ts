"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getMenuItem } from "@/lib/catalog";
import type { CartLine, Selections } from "@/content/types";
import { itemMacros, itemPrice } from "@/lib/nutrition";

function sameSelections(a: Selections, b: Selections) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const x = [...(a[k] ?? [])].sort().join();
    const y = [...(b[k] ?? [])].sort().join();
    if (x !== y) return false;
  }
  return true;
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

type AddInput = { itemId: string; selections: Selections; qty: number; note?: string };

type CartState = {
  lines: CartLine[];
  /** bumps on every add so the cart badge can animate */
  addedTick: number;
  add: (input: AddInput) => void;
  replace: (lineId: string, input: AddInput) => void;
  setQty: (lineId: string, qty: number) => void;
  remove: (lineId: string) => void;
  clear: () => void;
};

function snapshot(input: AddInput) {
  const item = getMenuItem(input.itemId);
  if (!item) throw new Error(`Unknown menu item ${input.itemId}`);
  return {
    unitPrice: itemPrice(item, input.selections),
    unitMacros: itemMacros(item, input.selections),
  };
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      addedTick: 0,
      add: (input) => {
        const note = input.note?.trim() || undefined;
        const existing = get().lines.find(
          (l) => l.itemId === input.itemId && l.note === note && sameSelections(l.selections, input.selections),
        );
        if (existing) {
          set((s) => ({
            addedTick: s.addedTick + 1,
            lines: s.lines.map((l) => (l.id === existing.id ? { ...l, qty: l.qty + input.qty } : l)),
          }));
          return;
        }
        const line: CartLine = { id: newId(), ...input, note, ...snapshot(input) };
        set((s) => ({ lines: [...s.lines, line], addedTick: s.addedTick + 1 }));
      },
      replace: (lineId, input) => {
        const note = input.note?.trim() || undefined;
        set((s) => ({
          lines: s.lines.map((l) => (l.id === lineId ? { ...l, ...input, note, ...snapshot(input) } : l)),
        }));
      },
      setQty: (lineId, qty) =>
        set((s) => ({
          lines: qty <= 0 ? s.lines.filter((l) => l.id !== lineId) : s.lines.map((l) => (l.id === lineId ? { ...l, qty } : l)),
        })),
      remove: (lineId) => set((s) => ({ lines: s.lines.filter((l) => l.id !== lineId) })),
      clear: () => set({ lines: [] }),
    }),
    {
      name: "superfit-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lines: s.lines }),
    },
  ),
);

type UIState = {
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
};

export const useCartUI = create<UIState>((set) => ({
  cartOpen: false,
  setCartOpen: (cartOpen) => set({ cartOpen }),
}));
