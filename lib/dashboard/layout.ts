import "server-only";
import { getSetting, setSetting } from "@/lib/settings";
import type { DB } from "@/lib/db";
import { normalizeLayout, type DashboardLayout } from "./catalog";

const KEY = "dashboard.layout";

export async function loadLayout(db: DB): Promise<DashboardLayout> {
  return normalizeLayout(await getSetting(db, KEY));
}

export async function saveLayout(db: DB, layout: unknown) {
  const clean = normalizeLayout(layout);
  await setSetting(db, KEY, clean);
  return clean;
}
