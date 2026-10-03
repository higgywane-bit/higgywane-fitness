import type { Plan } from "@/content/plans";
import { planList } from "@/lib/catalog";

/*
 * Train page maths. Prices come from the live plans (Admin → Site & content → Plans,
 * defaults from pricing.json); savings are always computed, never typed in.
 */

export type PTPackage = {
  id: string;
  name: string;
  sessions: number;
  price: number;
  perSession: number;
  /** saving vs buying the same number of single sessions */
  saving: number;
};

type RawPT = { id?: string; name: string; sessions: number; price: number };

export function ptPackages(products: RawPT[] = planList("pt").map((p) => ({ id: p.id, name: p.name, sessions: p.sessions ?? 1, price: p.price }))): PTPackage[] {
  const single = products.find((p) => p.sessions === 1)?.price ?? 0;
  return products.map((p) => ({
    id: p.id ?? `pt-${p.sessions}`,
    name: p.name,
    sessions: p.sessions,
    price: p.price,
    perSession: Math.floor(p.price / p.sessions),
    saving: Math.max(0, single * p.sessions - p.price),
  }));
}

export function getPTPackage(id: string): PTPackage | undefined {
  return ptPackages().find((p) => p.id === id);
}

export function lowestPerSession(): number {
  return Math.min(...ptPackages().map((p) => p.perSession));
}

export type Membership = {
  id: string;
  name: string;
  description: string;
  price: number;
  badge?: string;
  saving?: number;
};

/** Saving vs paying month by month, for plans measured in months. */
export function memberships(plans: Plan[] = planList("membership")): Membership[] {
  const monthly = plans.find((p) => "months" in p.duration && p.duration.months === 1)?.price;
  return plans.map((p) => {
    const months = "months" in p.duration ? p.duration.months : 0;
    const saving = monthly && months > 1 ? monthly * months - p.price : 0;
    return {
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      price: p.price,
      badge: p.badge,
      saving: saving > 0 ? saving : undefined,
    };
  });
}
