import { eq } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { media } from "@/lib/db/schema";
import { ServiceError } from "@/lib/errors";

const TYPES = ["image/webp", "image/jpeg", "image/png"];
const MAX_BYTES = 2_000_000;

/** Store an uploaded photo (a data: URL) and return its public path. */
export async function saveImage(db: DB, input: { dataUrl: string; width?: number; height?: number; alt?: string }): Promise<string> {
  const m = /^data:([a-z/]+);base64,([A-Za-z0-9+/=]+)$/.exec(input.dataUrl);
  if (!m || !TYPES.includes(m[1])) throw new ServiceError("Upload a JPG, PNG or WebP photo.");
  const bytes = Math.floor((m[2].length * 3) / 4);
  if (bytes > MAX_BYTES) throw new ServiceError("That photo is too big (2 MB max).");
  const [row] = await db
    .insert(media)
    .values({ contentType: m[1], data: m[2], bytes, width: input.width ?? null, height: input.height ?? null, alt: input.alt?.slice(0, 200) ?? null })
    .returning({ id: media.id });
  return `/media/${row.id}`;
}

export async function loadImage(db: DB, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
  return row ?? null;
}
