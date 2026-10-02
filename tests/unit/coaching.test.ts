import { describe, expect, it } from "vitest";
import { coaches, getCoach, specialties } from "@/content/coaches";
import { bookableDays, nowTime, openSlots, todayISO, validateBooking, validateMessage, type BookingInput } from "@/lib/booking";
import { lowestPerSession, ptPackages } from "@/lib/pricing";

describe("ptPackages", () => {
  it("computes savings vs single sessions from pricing.json", () => {
    const byCount = Object.fromEntries(ptPackages().map((p) => [p.sessions, p]));
    expect(byCount[1].saving).toBe(0);
    expect(byCount[3].saving).toBe(100);
    expect(byCount[10].saving).toBe(2000);
    expect(byCount[20].saving).toBe(7000);
    expect(byCount[20].perSession).toBe(1350);
    expect(lowestPerSession()).toBe(1350);
  });

  it("falls back to floor(price / sessions) when per-session price is missing", () => {
    const [, two] = ptPackages([
      { name: "1", sessions: 1, price: 1000 },
      { name: "2", sessions: 2, price: 1901 },
    ]);
    expect(two.perSession).toBe(950);
    expect(two.saving).toBe(99);
  });
});

describe("coaches", () => {
  it("has the four coaches with known specialties", () => {
    expect(coaches.map((c) => c.name)).toEqual(["Bella", "Nicha", "Aun", "Poom"]);
    for (const c of coaches) for (const s of c.specialties) expect(specialties[s], `${c.slug}:${s}`).toBeDefined();
  });
});

describe("booking", () => {
  const bella = getCoach("bella")!;

  it("lists two weeks of days and disables days off", () => {
    const days = bookableDays({ weekdays: [1, 2, 3, 4, 5, 6] }, "2026-10-04"); // a Sunday
    expect(days).toHaveLength(14);
    expect(days[0]).toMatchObject({ iso: "2026-10-04", weekday: 7, enabled: false, label: "Today" });
    expect(days[1]).toMatchObject({ iso: "2026-10-05", weekday: 1, enabled: true, label: "Tmrw" });
    expect(days[13].iso).toBe("2026-10-17");
  });

  it("formats today in Bangkok time", () => {
    expect(todayISO(new Date("2026-10-04T18:30:00Z"))).toBe("2026-10-05");
  });

  const base: BookingInput = {
    coach: "bella",
    packageId: "pt-1",
    date: "2026-10-05",
    time: "07:00",
    name: "Mint",
    contact: "0812345678",
  };

  it("accepts a valid booking", () => {
    expect(validateBooking(base, bella, true, "2026-10-04")).toEqual({ ok: true });
  });

  it("rejects days off, past days, unknown slots and missing contact", () => {
    expect(validateBooking({ ...base, date: "2026-10-04" }, bella, true, "2026-10-04").ok).toBe(false);
    expect(validateBooking({ ...base, date: "2026-10-01" }, bella, true, "2026-10-04").ok).toBe(false);
    expect(validateBooking({ ...base, time: "03:00" }, bella, true, "2026-10-04").ok).toBe(false);
    expect(validateBooking({ ...base, contact: " " }, bella, true, "2026-10-04").ok).toBe(false);
    expect(validateBooking(base, bella, false, "2026-10-04").ok).toBe(false);
  });

  it("hides today's times that start within the hour", () => {
    const coach = { slots: ["07:00", "16:00", "17:00", "18:00"] };
    expect(openSlots(coach, "2026-10-04", "2026-10-04", "16:10")).toEqual(["18:00"]);
    expect(openSlots(coach, "2026-10-05", "2026-10-04", "16:10")).toEqual(coach.slots);
    expect(nowTime(new Date("2026-10-04T09:05:00Z"))).toBe("16:05");
    const late = { ...base, date: "2026-10-05", time: "07:00" };
    expect(validateBooking(late, bella, true, "2026-10-05", "06:30").ok).toBe(false);
    expect(validateBooking(late, bella, true, "2026-10-04", "23:00").ok).toBe(true);
  });

  it("validates messages", () => {
    expect(validateMessage({ coach: "bella", name: "Mint", contact: "@mint", message: "Hi!" }, bella).ok).toBe(true);
    expect(validateMessage({ coach: "bella", name: "Mint", contact: "@mint", message: " " }, bella).ok).toBe(false);
  });
});
