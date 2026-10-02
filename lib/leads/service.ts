import { and, desc, eq, ne } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { activity, leads, type Lead, type LeadStage } from "@/lib/db/schema";
import { isISODate } from "@/lib/membership/dates";
import { createMember, logActivity, normalizeEmail, normalizePhone, ServiceError } from "@/lib/membership/service";

/*
 * Enquiries before they become members: walk-ins, Instagram DMs, website forms.
 * Stages: new → contacted → trial → won (became a member) / lost.
 */

export const STAGES: { id: LeadStage; label: string }[] = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "trial", label: "Trial / visited" },
  { id: "won", label: "Joined" },
  { id: "lost", label: "Lost" },
];

export const SOURCES = {
  "walk-in": "Walk-in",
  instagram: "Instagram",
  facebook: "Facebook",
  website: "Website",
  line: "LINE",
  referral: "Referral",
  google: "Google",
  other: "Other",
} as const;

export const INTERESTS = {
  membership: "Membership",
  pt: "Personal training",
  "day-pass": "Day pass",
  cafe: "Cafe",
  other: "Other",
} as const;

export type LeadInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  lineId?: string | null;
  source?: string;
  interest?: string;
  notes?: string | null;
  ownerId?: string | null;
  nextFollowUp?: string | null;
};

function values(input: LeadInput) {
  const name = input.name?.trim();
  if (!name) throw new ServiceError("Name is required.");
  if (input.nextFollowUp && !isISODate(input.nextFollowUp)) throw new ServiceError("Follow-up date isn't valid.");
  return {
    name,
    phone: normalizePhone(input.phone),
    email: normalizeEmail(input.email),
    lineId: input.lineId?.trim() || null,
    source: input.source && input.source in SOURCES ? input.source : "other",
    interest: input.interest && input.interest in INTERESTS ? input.interest : "membership",
    notes: input.notes?.trim() || null,
    ownerId: input.ownerId || null,
    nextFollowUp: input.nextFollowUp || null,
  };
}

export async function createLead(db: DB, input: LeadInput, now = new Date()): Promise<Lead> {
  const v = values(input);
  // the same person enquiring twice updates the open lead instead of duplicating it
  if (v.phone || v.email) {
    const open = await db
      .select()
      .from(leads)
      .where(and(ne(leads.stage, "won"), ne(leads.stage, "lost")));
    const dup = open.find((l) => (v.phone && l.phone === v.phone) || (v.email && l.email === v.email));
    if (dup) {
      const notes = [dup.notes, v.notes].filter(Boolean).join("\n");
      await db.update(leads).set({ notes: notes || null }).where(eq(leads.id, dup.id));
      await logActivity(db, null, "lead.repeat", `Enquired again via ${SOURCES[v.source as keyof typeof SOURCES]}`, now, { leadId: dup.id });
      return dup;
    }
  }
  const [row] = await db.insert(leads).values({ ...v, createdAt: now, stageChangedAt: now }).returning();
  await logActivity(db, null, "lead.created", `New lead from ${SOURCES[row.source as keyof typeof SOURCES]}`, now, { leadId: row.id });
  return row;
}

export async function updateLead(db: DB, id: string, input: LeadInput) {
  await db.update(leads).set(values(input)).where(eq(leads.id, id));
}

export async function setLeadStage(db: DB, id: string, stage: LeadStage, opts: { lostReason?: string } = {}) {
  if (!STAGES.some((s) => s.id === stage)) throw new ServiceError("Unknown stage.");
  const [row] = await db
    .update(leads)
    .set({ stage, stageChangedAt: new Date(), lostReason: stage === "lost" ? opts.lostReason?.trim() || null : null })
    .where(eq(leads.id, id))
    .returning();
  if (!row) throw new ServiceError("Lead not found.");
  const label = STAGES.find((s) => s.id === stage)!.label;
  await logActivity(db, null, "lead.stage", `Moved to ${label}${opts.lostReason ? ` · ${opts.lostReason}` : ""}`, new Date(), { leadId: id });
}

export async function addLeadNote(db: DB, id: string, note: string) {
  if (!note.trim()) throw new ServiceError("Write a note first.");
  await logActivity(db, null, "lead.note", note.trim().slice(0, 1000), new Date(), { leadId: id });
}

/** Lead joins: create the member (carrying contact details over) and mark the lead won. */
export async function convertLead(db: DB, id: string) {
  const [l] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!l) throw new ServiceError("Lead not found.");
  if (l.memberId) return l.memberId;
  const [first, ...rest] = l.name.split(/\s+/);
  const member = await createMember(db, {
    firstName: first,
    lastName: rest.join(" "),
    phone: l.phone,
    email: l.email,
    lineId: l.lineId,
    notes: l.notes,
    source: "admin",
  });
  await db.update(leads).set({ memberId: member.id, stage: "won", stageChangedAt: new Date() }).where(eq(leads.id, id));
  await logActivity(db, null, "lead.won", `Joined as member #${member.memberNo}`, new Date(), { leadId: id });
  await logActivity(db, member.id, "member.from-lead", `Came in as a lead from ${SOURCES[l.source as keyof typeof SOURCES] ?? l.source}`);
  return member.id;
}

export async function deleteLead(db: DB, id: string) {
  await db.delete(leads).where(eq(leads.id, id));
}

export async function leadTimeline(db: DB, id: string) {
  return db.select().from(activity).where(eq(activity.leadId, id)).orderBy(desc(activity.at));
}
