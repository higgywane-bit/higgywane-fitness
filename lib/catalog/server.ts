import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import type { DB } from "@/lib/db/client";
import { appSettings } from "@/lib/db/schema";
import { setSetting } from "@/lib/settings";
import type { Catalog, CatalogSection } from "./index";
import { catalogKey, ensureCatalog, primeCatalog, readCatalog } from "./store";
import { validateSection } from "./validate";

/**
 * The live catalog (defaults + saved edits). getDb() already refreshes it, so any
 * server code that touches the database is current; pages that don't, call this.
 */
export async function getCatalog(): Promise<Catalog> {
  return ensureCatalog(await getDb());
}

/** Validate and store one section; the whole section is replaced. */
export async function saveCatalogSection<S extends CatalogSection>(db: DB, section: S, value: unknown): Promise<Catalog[S]> {
  const current = await readCatalog(db);
  const clean = validateSection(section, value, current);
  await setSetting(db, catalogKey(section), clean);
  primeCatalog({ ...current, [section]: clean });
  return clean;
}

/** Back to the built-in defaults from content/ for one section. */
export async function resetCatalogSection(db: DB, section: CatalogSection) {
  await db.delete(appSettings).where(eq(appSettings.key, catalogKey(section)));
  primeCatalog(await readCatalog(db));
}
