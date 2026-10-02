import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

/**
 * Production: real Postgres (Supabase / Neon) via DATABASE_URL; run `npm run db:migrate` on deploy.
 * Local + tests: PGlite, a full Postgres compiled to WASM that lives in a folder
 * (`.data/pglite`) or in memory, migrated automatically. Same SQL, zero setup.
 */
export async function createDb(opts: { url?: string; dataDir?: string } = {}): Promise<{ db: DB; local: boolean }> {
  if (opts.url) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    const client = postgres(opts.url, { prepare: false, max: 5 });
    return { db: drizzle(client, { schema }) as unknown as DB, local: false };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(opts.dataDir ?? "memory://");
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return { db: db as unknown as DB, local: true };
}
