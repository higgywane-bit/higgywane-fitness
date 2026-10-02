import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildKnowledge } from "./knowledge";

let cached: string | null = null;

/** Knowledge document, built once per server instance (content only changes on deploy). */
export function knowledge(): string {
  if (cached !== null) return cached;
  let guide = "";
  try {
    guide = readFileSync(path.join(process.cwd(), "content/leah/guide.md"), "utf8");
  } catch {
    // guide is optional: Leah still knows prices, menu, coaches and hours
  }
  cached = buildKnowledge(guide);
  return cached;
}

/* Best-effort per-IP limit. One server instance only: use a shared store (Upstash, Vercel KV) when scaling out. */
const WINDOW_MS = 5 * 60_000;
const MAX_REQUESTS = 30;
const hits = new Map<string, number[]>();

export function rateLimited(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_REQUESTS;
}
