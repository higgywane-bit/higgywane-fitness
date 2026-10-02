"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Order } from "@/lib/orders";
import type { Payment } from "@/lib/payments/types";

type OrdersState = {
  orders: Order[];
  save: (order: Order) => void;
  updatePayment: (orderId: string, payment: Payment) => void;
};

export const useOrders = create<OrdersState>()(
  persist(
    (set) => ({
      orders: [],
      save: (order) => set((s) => ({ orders: [order, ...s.orders.filter((o) => o.id !== order.id)].slice(0, 10) })),
      updatePayment: (orderId, payment) =>
        set((s) => ({ orders: s.orders.map((o) => (o.id === orderId ? { ...o, payment } : o)) })),
    }),
    { name: "superfit-orders", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);
