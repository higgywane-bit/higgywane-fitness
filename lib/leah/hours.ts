import { TIMEZONE, type WeeklyHours } from "@/content/business";

type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHORT_TO_ISO: Record<string, Weekday> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function weekdayName(day: number) {
  return WEEKDAY_NAMES[day - 1];
}

/** Weekday and minutes since midnight in Bangkok, whatever the server's timezone. */
export function bangkokClock(date: Date): { weekday: Weekday; minutes: number; label: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const weekday = SHORT_TO_ISO[get("weekday")];
  return {
    weekday,
    minutes: hour * 60 + minute,
    label: `${weekdayName(weekday)} ${get("hour")}:${get("minute")}`,
  };
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export type OpenStatus =
  | { open: true; closesAt: string }
  | { open: false; opensAt: string; opensDay: Weekday; today: boolean }
  | { open: false; opensAt: null };

export function openStatus(hours: WeeklyHours, date: Date): OpenStatus {
  const { weekday, minutes } = bangkokClock(date);
  const today = hours[weekday];
  if (today && minutes >= toMinutes(today.open) && minutes < toMinutes(today.close)) {
    return { open: true, closesAt: today.close };
  }
  if (today && minutes < toMinutes(today.open)) {
    return { open: false, opensAt: today.open, opensDay: weekday, today: true };
  }
  for (let i = 1; i <= 7; i++) {
    const day = (((weekday - 1 + i) % 7) + 1) as Weekday;
    const h = hours[day];
    if (h) return { open: false, opensAt: h.open, opensDay: day, today: false };
  }
  return { open: false, opensAt: null };
}

export function describeStatus(name: string, hours: WeeklyHours, date: Date): string {
  const s = openStatus(hours, date);
  if (s.open) return `${name} is open now, until ${s.closesAt}.`;
  if (s.opensAt === null) return `${name} has no opening hours listed.`;
  return `${name} is closed now. Opens ${s.today ? "today" : weekdayName(s.opensDay)} at ${s.opensAt}.`;
}

/** "Mon–Fri 06:00–22:00 · Sat–Sun 07:00–20:00", grouping consecutive days with equal hours. */
export function formatWeek(hours: WeeklyHours): string {
  const short = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const key = (d: Weekday) => (hours[d] ? `${hours[d]!.open}–${hours[d]!.close}` : "Closed");
  const runs: { from: number; to: number; value: string }[] = [];
  for (let d = 1 as Weekday; d <= 7; d = (d + 1) as Weekday) {
    const value = key(d);
    const last = runs.at(-1);
    if (last && last.value === value) last.to = d;
    else runs.push({ from: d, to: d, value });
  }
  return runs
    .map((r) => `${r.from === r.to ? short[r.from - 1] : `${short[r.from - 1]}–${short[r.to - 1]}`} ${r.value}`)
    .join(" · ");
}
