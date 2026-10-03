import type { DB } from "@/lib/db/client";
import { getSetting, setSetting } from "@/lib/settings";

/** Monthly goals the owner sets; progress shows on Performance and the dashboard. */
export type Targets = { revenue: number | null; newMembers: number | null; activeMembers: number | null; ptSessions: number | null };

export const EMPTY_TARGETS: Targets = { revenue: null, newMembers: null, activeMembers: null, ptSessions: null };

export async function loadTargets(db: DB): Promise<Targets> {
  return { ...EMPTY_TARGETS, ...((await getSetting<Partial<Targets>>(db, "targets")) ?? {}) };
}

export async function saveTargets(db: DB, t: Targets) {
  const clean = (v: unknown) => {
    const n = Number(v);
    return v === null || v === "" || !Number.isFinite(n) || n <= 0 ? null : Math.round(n);
  };
  await setSetting(db, "targets", { revenue: clean(t.revenue), newMembers: clean(t.newMembers), activeMembers: clean(t.activeMembers), ptSessions: clean(t.ptSessions) });
}
