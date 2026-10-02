"use server";

import { getCoach } from "@/content/coaches";
import { nowTime, todayISO, validateBooking, validateMessage, type BookingInput, type MessageInput } from "@/lib/booking";
import { getPTPackage } from "@/lib/pricing";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type BookingRequest = { reference: string; coach: string; packageName: string; date: string; time: string };

export async function requestBooking(input: BookingInput): Promise<Result<BookingRequest>> {
  const coach = getCoach(input.coach);
  const pkg = getPTPackage(input.packageId);
  const now = new Date();
  const check = validateBooking(input, coach, Boolean(pkg), todayISO(now), nowTime(now));
  if (!check.ok) return check;

  // TODO: persist the request and notify the coach (LINE / staff dashboard)
  return {
    ok: true,
    data: {
      reference: `PT-${String(Date.now()).slice(-5)}`,
      coach: coach!.name,
      packageName: pkg!.name,
      date: input.date,
      time: input.time,
    },
  };
}

export async function sendCoachMessage(input: MessageInput): Promise<Result<{ coach: string }>> {
  const coach = getCoach(input.coach);
  const check = validateMessage(input, coach);
  if (!check.ok) return check;

  // TODO: deliver to the coach (LINE OA / staff inbox)
  return { ok: true, data: { coach: coach!.name } };
}
