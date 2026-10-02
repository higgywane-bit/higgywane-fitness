import "server-only";
import path from "node:path";
import { count } from "drizzle-orm";
import { createDb, type DB } from "./client";
import { members } from "./schema";
import { seedDemo } from "./seed";

export type { DB } from "./client";
export * as t from "./schema";

const globalForDb = globalThis as unknown as { __superfitDb?: Promise<DB> };

async function init(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  const { db, local } = await createDb({
    url,
    dataDir: process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite"),
  });
  // Local database starts with demo members so every screen has something to show.
  if (local && process.env.SEED_DEMO !== "0") {
    const [{ n }] = await db.select({ n: count() }).from(members);
    if (n === 0) await seedDemo(db);
  }
  return db;
}

/** One shared connection per server process (survives hot reloads in dev). */
export function getDb(): Promise<DB> {
  globalForDb.__superfitDb ??= init().catch((err) => {
    globalForDb.__superfitDb = undefined;
    throw err;
  });
  return globalForDb.__superfitDb;
}
