import { eq } from "drizzle-orm";
import { getCoach } from "@/content/coaches";
import type { DB } from "@/lib/db/client";
import { ptBookings } from "@/lib/db/schema";
import { logActivity, ServiceError } from "@/lib/membership/service";
import { createLead } from "@/lib/leads/service";

export const BOOKING_STATUS = {
  requested: "Requested",
  confirmed: "Confirmed",
  declined: "Declined",
  done: "Done",
} as const;

export type BookingStatus = keyof typeof BOOKING_STATUS;

/** The website asks for "phone or LINE ID" in one box: work out which it is. */
export function splitContact(raw: string): { phone: string | null; email: string | null; lineId: string | null } {
  const v = raw.trim();
  if (/@.+\./.test(v)) return { phone: null, email: v, lineId: null };
  if (v.replace(/[^\d]/g, "").length >= 8 && /^[\d\s+()-]+$/.test(v)) return { phone: v, email: null, lineId: null };
  return { phone: null, email: null, lineId: v.replace(/^@/, "") };
}

/** A PT request from the website: stored for the desk and the coach, and logged as a lead. */
export async function saveBookingRequest(
  db: DB,
  input: { reference: string; coachSlug: string; packageId: string; packageName: string; date: string; time: string; name: string; contact: string; goal?: string; note?: string },
) {
  const coach = getCoach(input.coachSlug);
  const contact = input.contact.trim();
  const lead = await createLead(db, {
    name: input.name,
    ...splitContact(contact),
    source: "website",
    interest: "pt",
    notes: `PT request: ${input.packageName} with ${coach?.name ?? input.coachSlug} on ${input.date} at ${input.time}${input.goal ? ` · goal: ${input.goal}` : ""}${input.note ? ` · ${input.note}` : ""}`,
  });
  const [row] = await db
    .insert(ptBookings)
    .values({
      reference: input.reference,
      coachSlug: input.coachSlug,
      packageId: input.packageId,
      date: input.date,
      time: input.time,
      name: input.name.trim(),
      contact,
      goal: input.goal?.trim() || null,
      note: input.note?.trim() || null,
      leadId: lead.id,
    })
    .returning();
  return row;
}

/** A "message a coach" note from the website becomes a lead. */
export async function saveCoachMessage(db: DB, input: { coachSlug: string; name: string; contact: string; message: string }) {
  const coach = getCoach(input.coachSlug);
  return createLead(db, {
    name: input.name,
    ...splitContact(input.contact),
    source: "website",
    interest: "pt",
    notes: `Message for ${coach?.name ?? input.coachSlug}: ${input.message}`,
  });
}

export async function setBookingStatus(db: DB, id: string, status: BookingStatus) {
  if (!(status in BOOKING_STATUS)) throw new ServiceError("Unknown status.");
  const [row] = await db.update(ptBookings).set({ status }).where(eq(ptBookings.id, id)).returning();
  if (!row) throw new ServiceError("Booking not found.");
  if (row.leadId) await logActivity(db, null, "lead.booking", `PT request ${row.reference} ${BOOKING_STATUS[status].toLowerCase()}`, new Date(), { leadId: row.leadId });
}
