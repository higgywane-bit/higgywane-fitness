import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, lt } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { authSessions } from "@/lib/db/schema";

/*
 * Sign-in for the PT app. Clients use email + password (set from their invite link);
 * coaches pick their name and enter their staff PIN. Either way the browser gets a
 * random token in an httpOnly cookie and only its sha-256 is stored, so a leaked
 * database can't be used to sign in. Swap for Supabase Auth later without touching
 * screens: they only call currentClient() / currentCoach() (lib/pt/session.ts).
 */

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_DAYS = { client: 90, coach: 30 } as const;
export type SessionKind = keyof typeof SESSION_DAYS;

export const MIN_PASSWORD = 8;

export function checkPassword(pw: string): string | null {
  if (typeof pw !== "string" || pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (pw.length > 200) return "That password is too long.";
  if (/^\d+$/.test(pw)) return "Mix in some letters, not just numbers.";
  return null;
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pw, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(pw, Buffer.from(salt, "base64url"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Random, URL-safe: for cookies and invite links. */
export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(db: DB, kind: SessionKind, subjectId: string, now = new Date()): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS[kind] * 86_400_000);
  await db.insert(authSessions).values({ tokenHash: hashToken(token), kind, subjectId, expiresAt, createdAt: now });
  // tidy expired sessions for this person
  await db.delete(authSessions).where(and(eq(authSessions.subjectId, subjectId), lt(authSessions.expiresAt, now)));
  return { token, expiresAt };
}

export async function sessionSubject(db: DB, kind: SessionKind, token: string | undefined, now = new Date()): Promise<string | null> {
  if (!token || token.length < 20 || token.length > 64) return null;
  const [row] = await db
    .select({ subjectId: authSessions.subjectId })
    .from(authSessions)
    .where(and(eq(authSessions.tokenHash, hashToken(token)), eq(authSessions.kind, kind), gt(authSessions.expiresAt, now)))
    .limit(1);
  return row?.subjectId ?? null;
}

export async function endSession(db: DB, token: string | undefined) {
  if (token) await db.delete(authSessions).where(eq(authSessions.tokenHash, hashToken(token)));
}

/** Sign out everywhere, e.g. after a password reset. */
export async function endAllSessions(db: DB, kind: SessionKind, subjectId: string) {
  await db.delete(authSessions).where(and(eq(authSessions.kind, kind), eq(authSessions.subjectId, subjectId)));
}
