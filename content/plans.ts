import pricing from "@/content/pricing.json";

/**
 * Membership + PT plans the front desk can sell. Prices come from pricing.json
 * (the owner's source of truth); this file only adds how long each plan lasts.
 */

export type PlanKind = "membership" | "pt";

/** Calendar length. 1 month = same date next month, minus a day. */
export type PlanDuration = { days: number } | { months: number };

export type Plan = {
  id: string;
  name: string;
  kind: PlanKind;
  price: number;
  duration: PlanDuration;
  /** PT packs: number of sessions */
  sessions?: number;
  badge?: string;
  /** one-line description shown on the Train page */
  description?: string;
  /** no longer sold, kept so past sales still resolve */
  hidden?: boolean;
};

const MEMBERSHIP_DURATION: Record<string, PlanDuration> = {
  "Day Pass": { days: 1 },
  "1 Week": { days: 7 },
  "2 Weeks": { days: 14 },
  "1 Month": { months: 1 },
  "3 Months": { months: 3 },
  "6 Months": { months: 6 },
  "12 Months": { months: 12 },
};

/** How long a PT pack stays valid. TODO: confirm with owner (PT pack expiry) */
function ptValidity(sessions: number): PlanDuration {
  if (sessions <= 1) return { months: 1 };
  if (sessions <= 3) return { months: 2 };
  if (sessions <= 10) return { months: 4 };
  return { months: 6 };
}

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export const PLANS: Plan[] = [
  ...pricing.sections.memberships.products.map((p): Plan => ({
    id: slug(p.name),
    name: p.name,
    kind: "membership",
    price: p.price,
    duration: MEMBERSHIP_DURATION[p.name] ?? { days: 30 },
    badge: "badge" in p ? p.badge : undefined,
    description: "description" in p ? p.description : undefined,
  })),
  ...pricing.sections.personal_training.products.map((p): Plan => ({
    id: `pt-${p.sessions}`,
    name: p.name,
    kind: "pt",
    price: p.price,
    duration: ptValidity(p.sessions),
    sessions: p.sessions,
  })),
];

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}
