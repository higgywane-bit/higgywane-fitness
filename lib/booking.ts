import type { Coach } from "@/content/types";

export const BOOKING_WINDOW_DAYS = 14;
export const TIME_ZONE = "Asia/Bangkok";

export type BookableDay = { iso: string; weekday: number; day: number; label: string; enabled: boolean };

/** Current time in Bangkok as HH:MM. */
export function nowTime(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
}

/** Session times still bookable on a date: today only offers times at least an hour away. */
export function openSlots(coach: Pick<Coach, "slots">, date: string, today: string, now: string): string[] {
  if (date !== today) return coach.slots;
  const [h, m] = now.split(":").map(Number);
  const cutoff = h * 60 + m + 60;
  return coach.slots.filter((s) => {
    const [sh, sm] = s.split(":").map(Number);
    return sh * 60 + sm >= cutoff;
  });
}

/** Today's date in Bangkok as YYYY-MM-DD. */
export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

function addDays(iso: string, n: number): Date {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

/** The next `count` days starting today, flagged by whether the coach works that day. */
export function bookableDays(coach: Pick<Coach, "weekdays">, fromISO: string, count = BOOKING_WINDOW_DAYS): BookableDay[] {
  return Array.from({ length: count }, (_, i) => {
    const d = addDays(fromISO, i);
    const weekday = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    return {
      iso: d.toISOString().slice(0, 10),
      weekday,
      day: d.getUTCDate(),
      label: i === 0 ? "Today" : i === 1 ? "Tmrw" : d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
      enabled: coach.weekdays.includes(weekday),
    };
  });
}

export type BookingInput = {
  coach: string;
  packageId: string;
  date: string;
  time: string;
  name: string;
  contact: string;
  goal?: string;
  note?: string;
};

export type MessageInput = { coach: string; name: string; contact: string; message: string };

type Check = { ok: true } | { ok: false; error: string };

function checkPerson(name: string, contact: string): Check {
  if (!name.trim()) return { ok: false, error: "Add your name." };
  if (contact.trim().length < 4) return { ok: false, error: "Add a phone number or LINE ID so the coach can reach you." };
  return { ok: true };
}

export function validateBooking(
  input: BookingInput,
  coach: Coach | undefined,
  packageExists: boolean,
  today: string,
  now = "00:00",
): Check {
  if (!coach) return { ok: false, error: "Choose a coach." };
  if (!packageExists) return { ok: false, error: "Choose a package." };
  const day = bookableDays(coach, today).find((d) => d.iso === input.date);
  if (!day || !day.enabled) return { ok: false, error: `${coach.name} is not available that day.` };
  if (!openSlots(coach, input.date, today, now).includes(input.time)) return { ok: false, error: "That time is no longer available. Choose another." };
  return checkPerson(input.name, input.contact);
}

export function validateMessage(input: MessageInput, coach: Coach | undefined): Check {
  if (!coach) return { ok: false, error: "Choose a coach." };
  const person = checkPerson(input.name, input.contact);
  if (!person.ok) return person;
  if (input.message.trim().length < 2) return { ok: false, error: "Write a short message." };
  return { ok: true };
}
