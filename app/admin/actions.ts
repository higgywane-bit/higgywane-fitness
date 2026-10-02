"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { searchMembers, recentCheckIns, todayCount, type FeedItem, type MemberListRow } from "@/lib/admin/queries";
import { planImport, removeDemoData, runImport, type ImportPlan } from "@/lib/membership/import";
import type { ImportMapping } from "@/lib/membership/glofox";
import * as svc from "@/lib/membership/service";
import { importSales } from "@/lib/sales/service";
import { getMailer } from "@/lib/email";
import { sendReminders } from "@/lib/membership/reminder-service";
import { saveLayout } from "@/lib/dashboard/layout";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>, revalidate = true): Promise<Result<T>> {
  try {
    const data = await fn();
    if (revalidate) revalidatePath("/admin", "layout");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof svc.ServiceError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

/* ── Check-in ─────────────────────────────────────────────── */

export async function checkInAction(input: { code?: string; memberId?: string; method: svc.CheckInMethod }) {
  return run(async () => {
    const db = await getDb();
    const result = await svc.checkIn(db, input);
    return { result, feed: await recentCheckIns(14), inToday: await todayCount() };
  }, false);
}

export async function deskFeedAction(): Promise<Result<{ feed: FeedItem[]; inToday: number }>> {
  return run(async () => ({ feed: await recentCheckIns(14), inToday: await todayCount() }), false);
}

export async function searchMembersAction(q: string): Promise<Result<MemberListRow[]>> {
  return run(() => searchMembers(q), false);
}

/* ── Members ──────────────────────────────────────────────── */

export async function createMemberAction(input: svc.MemberInput & { cardCode?: string; sell?: svc.SellInput }) {
  return run(async () => {
    const db = await getDb();
    const member = await svc.createMember(db, input);
    if (input.sell?.planId) await svc.sellPlan(db, member.id, input.sell);
    return { id: member.id };
  });
}

export async function duplicatesAction(input: { email?: string; phone?: string }, exceptId?: string) {
  return run(async () => {
    const rows = await svc.findDuplicates(await getDb(), input, exceptId);
    return rows.map((r) => ({ id: r.id, name: svc.fullName(r), memberNo: r.memberNo }));
  }, false);
}

export async function updateMemberAction(id: string, input: svc.MemberInput) {
  return run(async () => svc.updateMember(await getDb(), id, input));
}

export async function archiveMemberAction(id: string, archived: boolean) {
  return run(async () => svc.setArchived(await getDb(), id, archived));
}

export async function regenerateQrAction(memberId: string) {
  return run(async () => svc.regenerateQr(await getDb(), memberId));
}

export async function addCardAction(memberId: string, code: string) {
  return run(async () => svc.addCard(await getDb(), memberId, code));
}

export async function revokeCredentialAction(credentialId: string) {
  return run(async () => svc.revokeCredential(await getDb(), credentialId));
}

/* ── Plans ────────────────────────────────────────────────── */

export async function sellPlanAction(memberId: string, input: svc.SellInput) {
  return run(async () => {
    const m = await svc.sellPlan(await getDb(), memberId, input);
    return { startsOn: m.startsOn, endsOn: m.endsOn, planName: m.planName };
  });
}

export async function freezeAction(id: string, from: string, until: string) {
  return run(async () => svc.freezeMembership(await getDb(), id, from, until));
}

export async function unfreezeAction(id: string) {
  return run(async () => svc.unfreezeMembership(await getDb(), id));
}

export async function extendAction(id: string, days: number, reason?: string) {
  return run(async () => svc.extendMembership(await getDb(), id, days, reason));
}

export async function cancelMembershipAction(id: string, reason?: string) {
  return run(async () => svc.cancelMembership(await getDb(), id, reason));
}

export async function logSessionAction(id: string, delta: 1 | -1 = 1) {
  return run(async () => svc.useSession(await getDb(), id, delta));
}

/* ── Imports ──────────────────────────────────────────────── */

const MAX_CSV = 5_000_000;

export async function previewImportAction(csv: string, mapping?: ImportMapping, dayFirst = true): Promise<Result<ImportPlan>> {
  if (csv.length > MAX_CSV) return { ok: false, error: "That file is too big (5 MB max)." };
  return run(async () => planImport(await getDb(), csv, { mapping, dayFirst }), false);
}

export async function runImportAction(csv: string, mapping: ImportMapping, dayFirst = true) {
  if (csv.length > MAX_CSV) return { ok: false as const, error: "That file is too big (5 MB max)." };
  return run(async () => {
    const db = await getDb();
    // Re-plan on the server: the client only sends the file and the column choices.
    const plan = await planImport(db, csv, { mapping, dayFirst });
    return runImport(db, plan);
  });
}

export async function importSalesAction(csv: string) {
  if (csv.length > MAX_CSV) return { ok: false as const, error: "That file is too big (5 MB max)." };
  return run(async () => importSales(await getDb(), csv));
}

export async function removeDemoAction() {
  return run(async () => removeDemoData(await getDb()));
}

export async function sendRemindersAction() {
  return run(async () => sendReminders(await getDb(), getMailer()));
}

/* ── Dashboard ────────────────────────────────────────────── */

export async function saveDashboardAction(layout: unknown) {
  return run(async () => saveLayout(await getDb(), layout));
}
