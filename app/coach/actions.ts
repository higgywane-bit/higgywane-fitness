"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getDb, t } from "@/lib/db";
import { getMailer } from "@/lib/email";
import { memberMemberships, ServiceError, useSession } from "@/lib/membership/service";
import { memberStanding } from "@/lib/membership/access";
import { localDate } from "@/lib/membership/dates";
import { setLeadStage } from "@/lib/leads/service";
import type { LeadStage } from "@/lib/db/schema";
import { withActor } from "@/lib/staff/context";
import { hashPin } from "@/lib/staff/service";
import { addableMembers } from "@/lib/pt/queries";
import { baseUrl, requireCoach, startSession, stopSession } from "@/lib/pt/session";
import * as pt from "@/lib/pt/service";
import type { Visibility } from "@/lib/pt/clients";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

/** Every coach action: signed-in coach, logged as them, friendly errors. */
async function run<T>(fn: (coach: Awaited<ReturnType<typeof requireCoach>>) => Promise<T>, revalidate: string | false = "/coach"): Promise<Result<T>> {
  const coach = await requireCoach();
  try {
    const data = await withActor(coach.id, () => fn(coach));
    if (revalidate) revalidatePath(revalidate, "layout");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ServiceError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

/* ── sign in ──────────────────────────────────────────────── */

export async function coachLoginAction(staffId: string, pin: string): Promise<Result> {
  try {
    const db = await getDb();
    const s = await pt.coachLogin(db, staffId, (row) => !row.pinHash || row.pinHash === hashPin(row.id, pin));
    await startSession("coach", s.id);
  } catch (err) {
    if (err instanceof ServiceError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Something went wrong. Try again." };
  }
  return { ok: true, data: null };
}

export async function coachLogoutAction() {
  await stopSession("coach");
  redirect("/coach/login");
}

export async function setCoachLangAction(lang: "en" | "th") {
  (await cookies()).set("s1_lang", lang === "th" ? "th" : "en", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/coach", "layout");
}

/* ── clients ──────────────────────────────────────────────── */

export async function searchAddableAction(q: string) {
  return run(() => addableMembers(q.slice(0, 60)), false);
}

/** Add a member as my client and send their invite. */
export async function addClientAction(memberId: string) {
  return run(async (coach) => {
    const db = await getDb();
    const { client } = await pt.linkClient(db, { memberId, coachId: coach.id });
    const invite = client.status === "invited" ? await pt.sendInvite(db, getMailer(), client.id, await baseUrl()) : null;
    return { clientId: client.id, invite };
  });
}

export async function sendInviteAction(clientId: string, channel: "email" | "link") {
  return run(async (coach) => {
    const db = await getDb();
    await pt.clientForCoach(db, coach, clientId);
    return pt.sendInvite(db, getMailer(), clientId, await baseUrl(), { channel });
  });
}

export async function setVisibilityAction(clientId: string, patch: Partial<Visibility>) {
  return run(async (coach) => {
    const db = await getDb();
    await pt.clientForCoach(db, coach, clientId);
    return pt.setVisibility(db, clientId, patch);
  });
}

export async function setArchivedAction(clientId: string, archived: boolean) {
  return run(async (coach) => {
    const db = await getDb();
    await pt.clientForCoach(db, coach, clientId);
    return pt.setClientStatus(db, clientId, archived);
  });
}

export async function reassignAction(clientId: string, coachId: string) {
  return run(async (coach) => {
    if (!pt.seesAllClients(coach)) throw new ServiceError("Only the owner or a manager can move clients.");
    const db = await getDb();
    await pt.reassignCoach(db, clientId, coachId);
  });
}

/** Log a PT session (or no-show) against the client's open pack, credited to me. */
export async function logSessionAction(clientId: string, status: "done" | "no-show") {
  return run(async (coach) => {
    const db = await getDb();
    const client = await pt.clientForCoach(db, coach, clientId);
    const pack = memberStanding(await memberMemberships(db, client.memberId), localDate()).pt;
    if (!pack) throw new ServiceError("No open PT pack. Sell one at the front desk first.");
    await useSession(db, pack.membership.id, 1, { coachId: coach.id, status });
    return { left: pack.sessionsLeft - 1 };
  });
}

export async function undoSessionAction(clientId: string) {
  return run(async (coach) => {
    const db = await getDb();
    const client = await pt.clientForCoach(db, coach, clientId);
    const pack = memberStanding(await memberMemberships(db, client.memberId), localDate()).pt;
    if (!pack) throw new ServiceError("No open PT pack.");
    await useSession(db, pack.membership.id, -1);
  });
}

/* ── plans ────────────────────────────────────────────────── */

export async function savePlanAction(clientId: string, kind: pt.PlanKind, doc: unknown, expectedVersion: number) {
  return run(async (coach) => {
    const db = await getDb();
    await pt.clientForCoach(db, coach, clientId);
    return pt.savePlan(db, { clientId, kind, doc, coachId: coach.id, expectedVersion });
  });
}

/* ── programs (templates) ─────────────────────────────────── */

export async function saveTemplateAction(input: { id?: string; kind: "workout" | "diet"; name: string; doc: unknown }) {
  return run(async (coach) => {
    const row = await pt.saveTemplate(await getDb(), { ...input, coachId: coach.id });
    return { id: row.id };
  });
}

export async function deleteTemplateAction(id: string) {
  return run(async (coach) => pt.deleteTemplate(await getDb(), coach.id, id));
}

export async function applyTemplateAction(templateId: string, clientId: string) {
  return run(async (coach) => pt.applyTemplate(await getDb(), { templateId, clientId, coach }));
}

/* ── library ──────────────────────────────────────────────── */

export async function addExerciseAction(input: { name: string; group: string; equipment?: string; log: string; sets?: number; reps?: number; seconds?: number }) {
  return run(async (coach) => pt.addCustomExercise(await getDb(), coach.id, input), false);
}

export async function addCueAction(input: { group: string; en: string; th?: string }) {
  return run(async (coach) => pt.addCustomCue(await getDb(), coach.id, input), false);
}

/* ── notifications & leads ────────────────────────────────── */

export async function markReadAction(clientIds: string[], ids?: string[]) {
  return run(async (coach) => {
    const db = await getDb();
    const allowed: string[] = [];
    for (const id of clientIds.slice(0, 200)) {
      try {
        allowed.push((await pt.clientForCoach(db, coach, id)).id);
      } catch {
        /* not theirs */
      }
    }
    await pt.markRead(db, "coach", allowed, ids);
  });
}

export async function coachInboxAction() {
  return run(async (coach) => {
    const rows = await pt.coachInbox(await getDb(), coach, { limit: 30 });
    return rows.map((n) => ({ id: n.id, clientId: n.clientId, title: n.title, body: n.body, href: n.href, at: n.createdAt.toISOString(), unread: !n.readAt }));
  }, false);
}

export async function setLeadStageAction(leadId: string, stage: LeadStage) {
  return run(async (coach) => {
    const db = await getDb();
    const [lead] = await db.select({ id: t.leads.id }).from(t.leads).where(and(eq(t.leads.id, leadId), eq(t.leads.ownerId, coach.id))).limit(1);
    if (!lead) throw new ServiceError("Lead not found.");
    await setLeadStage(db, leadId, stage);
  });
}
