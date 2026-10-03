import { getDb } from "@/lib/db";
import { loadImage } from "@/lib/media/service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const row = await loadImage(await getDb(), (await params).id);
  if (!row) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(row.data, "base64"), {
    headers: {
      "Content-Type": row.contentType,
      // ids are never reused, so the bytes behind one never change
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
