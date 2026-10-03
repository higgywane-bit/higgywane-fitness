"use server";

import { revalidatePath } from "next/cache";
import { actingStaffId } from "@/lib/staff/session";
import { NotSignedInError, requireAdmin } from "@/lib/admin-session";
import { withActor } from "@/lib/staff/context";
import { getDb } from "@/lib/db";
import { searchMembers, recentCheckIns, todayCount, type FeedItem, type MemberListRow } from "@/lib/admin/queries";
import { planImport, removeDemoData, runImport, type ImportPlan } from "@/lib/membership/import";
import type { ImportMapping } from "@/lib/membership/glofox";
import * as svc from "@/lib/membership/service";
import { importSales } from "@/lib/sales/service";
import { getMailer } from "@/lib/email";
import { sendReminders } from "@/lib/membership/reminder-service";
import { saveLayout } from "@/lib/dashboard/layout";
import { deleteReport, saveReport, updateReport } from "@/lib/reports/service";
import type { ReportKind } from "@/lib/reports/analyze";
import { listMembers } from "@/lib/admin/queries";
import { addMemberNote, recipientsFor, sendMessage, setMemberTags } from "@/lib/messages/service";
import type { SegmentId } from "@/lib/messages/segments";
import { addLeadNote, convertLead, createLead, deleteLead, leadTimeline, setLeadStage, updateLead, type LeadInput } from "@/lib/leads/service";
import type { CafeOrderStatus, LeadStage } from "@/lib/db/schema";
import { setBookingStatus, type BookingStatus } from "@/lib/coaching/service";
import { boardOrders, markOrderPaid, setOrderStatus } from "@/lib/cafe/orders";
import { serializeOrders } from "@/lib/cafe/serialize";
import {
  addShift,
  clockIn,
  clockOut,
  copyWeek,
  createStaff,
  removeShift,
  setStaffActive,
  updateStaff,
  verifyPin,
  type ShiftInput,
  type StaffInput,
} from "@/lib/staff/service";
import { setActingStaff } from "@/lib/staff/session";
import { addExpense, deleteExpense, endRecurring, type ExpenseInput } from "@/lib/expenses/service";
import { saveTargets, type Targets } from "@/lib/performance/targets";
import type { CatalogSection } from "@/lib/catalog";
import { resetCatalogSection, saveCatalogSection } from "@/lib/catalog/server";
import { saveImage } from "@/lib/media/service";
import { logActivity } from "@/lib/membership/service";

const CATALOG_LABELS: Record<CatalogSection, string> = {
  categories: "menu categories",
  menu: "menu",
  optionGroups: "add-ons",
  ingredients: "ingredients",
  coaches: "coaches",
  plans: "plans & prices",
  business: "business details",
};

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

/** Every admin action runs as the staff member currently working (for the activity log). */
async function run<T>(fn: () => Promise<T>, revalidate = true): Promise<Result<T>> {
  try {
    await requireAdmin();
    const data = await withActor(await actingStaffId(), fn);
    if (revalidate) revalidatePath("/admin", "layout");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof svc.ServiceError || err instanceof NotSignedInError) return { ok: false, error: err.message };
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

export async function quickPassAction(input: svc.QuickPassInput) {
  return run(async () => {
    const db = await getDb();
    const { result } = await svc.quickPass(db, input);
    return { result, feed: await recentCheckIns(14), inToday: await todayCount() };
  });
}

export async function linkCodeAction(memberId: string, code: string) {
  return run(async () => {
    const db = await getDb();
    const result = await svc.linkCodeAndCheckIn(db, memberId, code);
    return { result, feed: await recentCheckIns(14), inToday: await todayCount() };
  });
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

/* ── Insights (uploaded reports) ──────────────────────────── */

export async function uploadReportAction(csv: string, fileName: string) {
  if (csv.length > 15_000_000) return { ok: false as const, error: "That file is too big (15 MB max). Export a shorter date range." };
  return run(async () => saveReport(await getDb(), { csv, fileName }));
}

export async function updateReportAction(id: string, patch: { kind?: ReportKind; name?: string }) {
  return run(async () => updateReport(await getDb(), id, patch));
}

export async function deleteReportAction(id: string) {
  return run(async () => deleteReport(await getDb(), id));
}

/* ── Members: tags, notes ─────────────────────────────────── */

export async function setTagsAction(memberId: string, tags: string) {
  return run(async () => setMemberTags(await getDb(), memberId, tags));
}

export async function addNoteAction(memberId: string, note: string) {
  return run(async () => addMemberNote(await getDb(), memberId, note));
}

/* ── Messages ─────────────────────────────────────────────── */

export async function previewAudienceAction(audience: SegmentId) {
  return run(async () => {
    const rows = recipientsFor(await listMembers(), audience);
    return { count: rows.length, sample: rows.slice(0, 5).map((r) => ({ name: r.name, email: r.email })) };
  }, false);
}

export async function sendMessageAction(input: { audience: SegmentId; subject: string; body: string }) {
  return run(async () => {
    const row = await sendMessage(await getDb(), getMailer(), await listMembers(), input);
    return { id: row.id, sent: row.sent, status: row.status };
  });
}

/* ── Leads ────────────────────────────────────────────────── */

export async function createLeadAction(input: LeadInput) {
  return run(async () => (await createLead(await getDb(), input)).id);
}

export async function updateLeadAction(id: string, input: LeadInput) {
  return run(async () => updateLead(await getDb(), id, input));
}

export async function setLeadStageAction(id: string, stage: LeadStage, lostReason?: string) {
  return run(async () => setLeadStage(await getDb(), id, stage, { lostReason }));
}

export async function addLeadNoteAction(id: string, note: string) {
  return run(async () => addLeadNote(await getDb(), id, note));
}

export async function convertLeadAction(id: string) {
  return run(async () => convertLead(await getDb(), id));
}

export async function deleteLeadAction(id: string) {
  return run(async () => deleteLead(await getDb(), id));
}

export async function leadTimelineAction(id: string) {
  return run(async () => (await leadTimeline(await getDb(), id)).map((a) => ({ id: a.id, type: a.type, message: a.message, at: a.at.toISOString() })), false);
}

/* ── Coaching ─────────────────────────────────────────────── */

export async function setBookingStatusAction(id: string, status: BookingStatus) {
  return run(async () => setBookingStatus(await getDb(), id, status));
}

export async function logPtSessionAction(membershipId: string, coachId: string | null, status: "done" | "no-show" = "done") {
  return run(async () => svc.useSession(await getDb(), membershipId, 1, { coachId, status }));
}

/* ── Cafe orders ──────────────────────────────────────────── */

export async function setOrderStatusAction(id: string, status: CafeOrderStatus) {
  return run(async () => {
    await setOrderStatus(await getDb(), id, status);
  });
}

export async function markOrderPaidAction(id: string) {
  return run(async () => markOrderPaid(await getDb(), id));
}

export async function cafeBoardAction() {
  return run(async () => serializeOrders(await boardOrders(await getDb())), false);
}

/* ── Staff, rota, time clock ──────────────────────────────── */

export async function createStaffAction(input: StaffInput) {
  return run(async () => (await createStaff(await getDb(), input)).id);
}

export async function updateStaffAction(id: string, input: StaffInput) {
  return run(async () => updateStaff(await getDb(), id, input));
}

export async function setStaffActiveAction(id: string, active: boolean) {
  return run(async () => setStaffActive(await getDb(), id, active));
}

export async function addShiftAction(input: ShiftInput) {
  return run(async () => {
    await addShift(await getDb(), input);
  });
}

export async function removeShiftAction(id: string) {
  return run(async () => removeShift(await getDb(), id));
}

export async function copyWeekAction(fromMonday: string, toMonday: string) {
  return run(async () => copyWeek(await getDb(), fromMonday, toMonday));
}

export async function clockAction(staffId: string, direction: "in" | "out") {
  return run(async () => {
    const db = await getDb();
    if (direction === "in") await clockIn(db, staffId);
    else await clockOut(db, staffId);
  });
}

/** Switch who's working on this device. Staff with a PIN must enter it. */
export async function switchStaffAction(staffId: string | null, pin: string) {
  try {
    await requireAdmin();
    if (!staffId) {
      await setActingStaff(null);
      revalidatePath("/admin", "layout");
      return { ok: true as const, data: null };
    }
    const s = await verifyPin(await getDb(), staffId, pin);
    await setActingStaff(s.id);
    revalidatePath("/admin", "layout");
    return { ok: true as const, data: { name: s.name } };
  } catch (err) {
    if (err instanceof svc.ServiceError || err instanceof NotSignedInError) return { ok: false as const, error: err.message };
    return { ok: false as const, error: "Something went wrong. Try again." };
  }
}

/* ── Expenses & targets ───────────────────────────────────── */

export async function addExpenseAction(input: ExpenseInput) {
  return run(async () => {
    await addExpense(await getDb(), input);
  });
}

export async function deleteExpenseAction(id: string) {
  return run(async () => deleteExpense(await getDb(), id));
}

export async function endRecurringAction(id: string, endsOn: string) {
  return run(async () => endRecurring(await getDb(), id, endsOn));
}

export async function saveTargetsAction(targets: Targets) {
  return run(async () => saveTargets(await getDb(), targets));
}

/* ── Site & content (catalog) ─────────────────────────────── */

export async function saveCatalogAction(section: CatalogSection, value: unknown) {
  return run(async () => {
    const saved = await saveCatalogSection(await getDb(), section, value);
    await logActivity(await getDb(), null, "content.saved", `Site content updated: ${CATALOG_LABELS[section]}`);
    revalidatePath("/", "layout");
    return saved;
  });
}

export async function resetCatalogAction(section: CatalogSection) {
  return run(async () => {
    await resetCatalogSection(await getDb(), section);
    await logActivity(await getDb(), null, "content.reset", `Site content reset to defaults: ${CATALOG_LABELS[section]}`);
    revalidatePath("/", "layout");
  });
}

export async function uploadImageAction(input: { dataUrl: string; width?: number; height?: number; alt?: string }) {
  if (input.dataUrl.length > 3_000_000) return { ok: false as const, error: "That photo is too big (2 MB max)." };
  return run(async () => saveImage(await getDb(), input), false);
}
