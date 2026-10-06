/*
 * Slows down guessing: after 5 wrong tries for the same key (a coach id, or an email)
 * that key is locked for 5 minutes. In memory per server instance, which is enough to
 * stop a 4-digit PIN being walked through; use a shared store (Supabase / Upstash) at scale.
 */
const MAX = 5;
const LOCK_MS = 5 * 60_000;
const tries = new Map<string, { n: number; until: number }>();

export function lockedFor(key: string, now = Date.now()): number {
  const t = tries.get(key);
  return t && t.until > now ? Math.ceil((t.until - now) / 60_000) : 0;
}

export function failed(key: string, now = Date.now()) {
  const t = tries.get(key);
  const n = t && t.until <= now && t.n >= MAX ? 1 : (t?.n ?? 0) + 1;
  tries.set(key, { n, until: n >= MAX ? now + LOCK_MS : 0 });
  if (tries.size > 5000) tries.clear();
}

export function succeeded(key: string) {
  tries.delete(key);
}
