import type { Macros, Selections } from "@/content/types";
import type { Payment, PaymentMethod } from "@/lib/payments/types";

export type ServiceMode = "takeaway" | "dine-in";

export type OrderInput = {
  lines: { itemId: string; qty: number; selections: Selections; note?: string }[];
  customer: { name: string; contact?: string };
  pickup: { asap: boolean; time?: string };
  service: { mode: ServiceMode; table?: string };
  note?: string;
  method: PaymentMethod;
};

export type OrderLine = {
  itemId: string;
  name: string;
  qty: number;
  selections: Selections;
  summary: string[];
  note?: string;
  unitPrice: number;
  unitMacros: Macros;
};

export type Order = {
  id: string;
  number: string;
  createdAt: string;
  lines: OrderLine[];
  subtotal: number;
  macros: Macros;
  customer: OrderInput["customer"];
  pickup: OrderInput["pickup"];
  service: OrderInput["service"];
  note?: string;
  payment: Payment;
};

/** 15-minute pickup slots from 20 minutes from now until closing. TODO: confirm with cafe (opening hours) */
export function pickupSlots(now = new Date(), closeHour = 21): string[] {
  const start = new Date(now.getTime() + 20 * 60 * 1000);
  start.setSeconds(0, 0);
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15);
  const slots: string[] = [];
  const t = new Date(start);
  while (t.getHours() < closeHour && slots.length < 16) {
    slots.push(`${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`);
    t.setMinutes(t.getMinutes() + 15);
  }
  return slots;
}
