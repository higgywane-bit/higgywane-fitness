"use server";

import { getCoach } from "@/lib/catalog";
import { getCatalog } from "@/lib/catalog/server";
import { nowTime, todayISO, validateBooking, validateMessage, type BookingInput, type MessageInput } from "@/lib/booking";
import { getPTPackage } from "@/lib/pricing";
import { getDb } from "@/lib/db";
import { saveBookingRequest, saveCoachMessage } from "@/lib/coaching/service";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type BookingRequest = { reference: string; coach: string; packageName: string; date: string; time: string };

export async function requestBooking(input: BookingInput): Promise<Result<BookingRequest>> {
  await getCatalog();
  const coach = getCoach(input.coach);
  const pkg = getPTPackage(input.packageId);
  const now = new Date();
  const check = validateBooking(input, coach, Boolean(pkg), todayISO(now), nowTime(now));
  if (!check.ok) return check;

  const reference = `PT-${String(Date.now()).slice(-5)}`;
  // Lands in Admin → Coaching (and as a lead). Notifying the coach by LINE comes later.
  try {
    await saveBookingRequest(await getDb(), {
      reference,
      coachSlug: coach!.slug,
      packageId: pkg!.id,
      packageName: pkg!.name,
      date: input.date,
      time: input.time,
      name: input.name,
      contact: input.contact,
      goal: input.goal,
      note: input.note,
    });
  } catch (err) {
    console.error("PT request not saved to admin", err);
  }
  return {
    ok: true,
    data: { reference, coach: coach!.name, packageName: pkg!.name, date: input.date, time: input.time },
  };
}

export async function sendCoachMessage(input: MessageInput): Promise<Result<{ coach: string }>> {
  await getCatalog();
  const coach = getCoach(input.coach);
  const check = validateMessage(input, coach);
  if (!check.ok) return check;

  // Lands in Admin → Leads. Delivering to the coach by LINE comes later.
  try {
    await saveCoachMessage(await getDb(), { coachSlug: coach!.slug, name: input.name, contact: input.contact, message: input.message });
  } catch (err) {
    console.error("coach message not saved to admin", err);
  }
  return { ok: true, data: { coach: coach!.name } };
}
