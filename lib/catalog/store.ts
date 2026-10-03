import { like } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { appSettings } from "@/lib/db/schema";
import { CATALOG_SECTIONS, DEFAULT_CATALOG, setCatalog, type Catalog, type CatalogSection } from "./index";

export const catalogKey = (s: CatalogSection) => `catalog:${s}`;

/** Other server instances pick up edits within this window. */
const TTL_MS = 5_000;
const g = globalThis as unknown as { __sfCatalog?: { at: number; value: Catalog } };

export async function readCatalog(db: DB): Promise<Catalog> {
  const rows = await db.select().from(appSettings).where(like(appSettings.key, "catalog:%"));
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const out = { ...DEFAULT_CATALOG } as Record<CatalogSection, unknown>;
  for (const s of CATALOG_SECTIONS) if (stored.has(catalogKey(s))) out[s] = stored.get(catalogKey(s));
  return out as Catalog;
}

/** Load the live catalog (cached for a few seconds) and make it current for every accessor. */
export async function ensureCatalog(db: DB): Promise<Catalog> {
  const hit = g.__sfCatalog;
  if (hit && Date.now() - hit.at < TTL_MS) {
    setCatalog(hit.value);
    return hit.value;
  }
  const value = await readCatalog(db);
  g.__sfCatalog = { at: Date.now(), value };
  setCatalog(value);
  return value;
}

export function primeCatalog(value: Catalog | undefined) {
  g.__sfCatalog = value ? { at: Date.now(), value } : undefined;
  if (value) setCatalog(value);
}
