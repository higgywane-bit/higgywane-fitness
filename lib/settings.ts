import { eq } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { appSettings } from "@/lib/db/schema";

export async function getSetting<T>(db: DB, key: string): Promise<T | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return (row?.value as T) ?? null;
}

export async function setSetting(db: DB, key: string, value: unknown) {
  await db
    .insert(appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
}
