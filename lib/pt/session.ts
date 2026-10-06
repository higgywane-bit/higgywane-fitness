import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, t } from "@/lib/db";
import { createSession, endSession, sessionSubject, SESSION_DAYS, type SessionKind } from "./auth";
import { visibilityOf } from "./clients";
import { clientForMember, COACH_ROLES } from "./service";

/*
 * Who is signed in to the PT app. Pages call requireClient() / requireCoach(); actions call
 * the same and get the person back, so every query is scoped to them.
 */

export const COOKIES: Record<SessionKind, string> = { client: "s1_client", coach: "s1_coach" };

export async function startSession(kind: SessionKind, subjectId: string) {
  const { token, expiresAt } = await createSession(await getDb(), kind, subjectId);
  (await cookies()).set(COOKIES[kind], token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_DAYS[kind] * 86_400,
  });
}

export async function stopSession(kind: SessionKind) {
  const jar = await cookies();
  await endSession(await getDb(), jar.get(COOKIES[kind])?.value);
  jar.delete(COOKIES[kind]);
}

/** The signed-in coach (staff row), or null. Cached per request. */
export const currentCoach = cache(async () => {
  const db = await getDb();
  const id = await sessionSubject(db, "coach", (await cookies()).get(COOKIES.coach)?.value);
  if (!id) return null;
  const [s] = await db.select().from(t.staff).where(eq(t.staff.id, id)).limit(1);
  return s && s.active && (COACH_ROLES as readonly string[]).includes(s.role) ? s : null;
});

/** The signed-in client: their member row and PT client record. Cached per request. */
export const currentClient = cache(async () => {
  const db = await getDb();
  const memberId = await sessionSubject(db, "client", (await cookies()).get(COOKIES.client)?.value);
  if (!memberId) return null;
  const [member] = await db.select().from(t.members).where(eq(t.members.id, memberId)).limit(1);
  const client = member ? await clientForMember(db, member.id) : null;
  if (!member || !client) return null;
  const [account] = await db.select({ lang: t.clientAccounts.lang, email: t.clientAccounts.email }).from(t.clientAccounts).where(eq(t.clientAccounts.memberId, memberId)).limit(1);
  return { member, client, visibility: visibilityOf(client.visibility), lang: (account?.lang === "th" ? "th" : "en") as "en" | "th", email: account?.email ?? null };
});

export async function requireCoach() {
  const coach = await currentCoach();
  if (!coach) redirect("/coach/login");
  return coach;
}

export async function requireClient() {
  const me = await currentClient();
  if (!me) redirect("/app/login");
  return me;
}

/** Absolute site address for links in emails: APP_URL when set, else the request's host. */
export async function baseUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const { headers } = await import("next/headers");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
