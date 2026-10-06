"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, t } from "@/lib/db";
import { getMailer } from "@/lib/email";
import { ServiceError } from "@/lib/membership/service";
import { baseUrl, requireClient, startSession, stopSession } from "@/lib/pt/session";
import * as pt from "@/lib/pt/service";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: (me: Awaited<ReturnType<typeof requireClient>>) => Promise<T>, revalidate: string | false = "/app"): Promise<Result<T>> {
  const me = await requireClient();
  try {
    const data = await fn(me);
    if (revalidate) revalidatePath(revalidate, "layout");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ServiceError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

async function open(fn: () => Promise<void>): Promise<Result> {
  try {
    await fn();
    return { ok: true, data: null };
  } catch (err) {
    if (err instanceof ServiceError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

/* ── sign in ──────────────────────────────────────────────── */

export async function loginAction(email: string, password: string): Promise<Result> {
  return open(async () => {
    const { memberId } = await pt.clientLogin(await getDb(), email, password);
    await startSession("client", memberId);
  });
}

export async function joinAction(token: string, email: string, password: string): Promise<Result> {
  return open(async () => {
    const { memberId } = await pt.acceptInvite(await getDb(), token, { email, password });
    await startSession("client", memberId);
  });
}

/** Always answers the same way, so nobody can find out which emails have accounts. */
export async function forgotAction(email: string): Promise<Result> {
  return open(async () => pt.requestLoginHelp(await getDb(), getMailer(), email, await baseUrl()));
}

export async function logoutAction() {
  await stopSession("client");
  redirect("/app/login");
}

export async function setLangAction(lang: "en" | "th") {
  return run(async (me) => {
    await (await getDb()).update(t.clientAccounts).set({ lang: lang === "th" ? "th" : "en" }).where(eq(t.clientAccounts.memberId, me.member.id));
  });
}

/* ── workouts ─────────────────────────────────────────────── */

export async function finishWorkoutAction(log: unknown) {
  return run(async (me) => {
    if (!me.visibility.workouts) throw new ServiceError("Workouts are switched off for you.");
    return pt.saveWorkout(await getDb(), me.client.id, log);
  });
}

/* ── daily feedback ───────────────────────────────────────── */

export async function saveFeedbackAction(date: string, answers: unknown, complete: boolean) {
  return run(async (me) => {
    if (!me.visibility.feedback) throw new ServiceError("Daily feedback is switched off for you.");
    const res = await pt.saveFeedback(await getDb(), { clientId: me.client.id, date, answers, complete });
    return { completedAt: res.completedAt?.toISOString() ?? null };
  }, complete ? "/app" : false);
}

/* ── notices ──────────────────────────────────────────────── */

export async function dismissNoticesAction(ids?: string[]) {
  return run(async (me) => pt.markRead(await getDb(), "client", [me.client.id], ids));
}

export async function seenAction() {
  return run(async (me) => pt.touchClient(await getDb(), me.client.id), false);
}
