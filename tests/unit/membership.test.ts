import { describe, expect, it } from "vitest";
import {
  applyFreeze,
  coverageEnd,
  daysLeftLabel,
  endFreeze,
  evaluateAccess,
  memberStanding,
  nextStartDate,
  planEndDate,
  type MembershipLike,
} from "@/lib/membership/access";
import { addDays, addMonths, diffDays, localDate } from "@/lib/membership/dates";
import { formatAccessCode, generateAccessCode, normalizeCode } from "@/lib/membership/codes";

const m = (over: Partial<MembershipLike>): MembershipLike => ({
  id: Math.random().toString(36),
  kind: "membership",
  planName: "1 Month",
  startsOn: "2026-10-01",
  endsOn: "2026-10-31",
  ...over,
});

describe("dates", () => {
  it("uses Bangkok time for today", () => {
    // 20:00 UTC on 1 Oct is 03:00 on 2 Oct in Thailand
    expect(localDate(new Date("2026-10-01T20:00:00Z"))).toBe("2026-10-02");
    expect(localDate(new Date("2026-10-01T16:59:00Z"))).toBe("2026-10-01");
  });
  it("adds calendar months, clamping to month end", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
  });
  it("diffs days across months", () => {
    expect(diffDays("2026-09-28", "2026-10-03")).toBe(5);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("plan lengths", () => {
  it("day pass is today only", () => expect(planEndDate("2026-10-02", { days: 1 })).toBe("2026-10-02"));
  it("1 week is 7 days inclusive", () => expect(planEndDate("2026-10-02", { days: 7 })).toBe("2026-10-08"));
  it("1 month ends the day before the same date next month", () => expect(planEndDate("2026-10-02", { months: 1 })).toBe("2026-11-01"));
  it("12 months", () => expect(planEndDate("2026-10-02", { months: 12 })).toBe("2027-10-01"));
});

describe("access", () => {
  it("lets an active member in, with days left", () => {
    const d = evaluateAccess([m({})], "2026-10-11");
    expect(d.allowed).toBe(true);
    expect(d.allowed && d.standing.daysLeft).toBe(20);
    expect(d.allowed && d.nudge).toBe(null);
  });
  it("nudges near the end and on the last day", () => {
    const soon = evaluateAccess([m({})], "2026-10-29");
    expect(soon.allowed && soon.nudge).toBe("renew-soon");
    const last = evaluateAccess([m({})], "2026-10-31");
    expect(last.allowed && last.nudge).toBe("last-day");
    expect(last.allowed && last.standing.status).toBe("expiring");
  });
  it("turns away expired members with how long ago", () => {
    const d = evaluateAccess([m({})], "2026-11-03");
    expect(d.allowed).toBe(false);
    expect(!d.allowed && d.reason).toBe("expired");
    expect(d.standing?.daysSinceExpiry).toBe(3);
  });
  it("counts paid-ahead renewals in days left", () => {
    const ms = [m({}), m({ startsOn: "2026-11-01", endsOn: "2026-11-30" })];
    expect(coverageEnd(ms, ms[0])).toBe("2026-11-30");
    expect(memberStanding(ms, "2026-10-30").daysLeft).toBe(31);
    expect(memberStanding(ms, "2026-10-30").status).toBe("active");
  });
  it("ignores cancelled plans", () => {
    const d = evaluateAccess([m({ cancelledAt: new Date() })], "2026-10-10");
    expect(!d.allowed && d.reason).toBe("no-membership");
  });
  it("says not started for future plans", () => {
    const d = evaluateAccess([m({ startsOn: "2026-10-20" })], "2026-10-10");
    expect(!d.allowed && d.reason).toBe("not-started");
  });
  it("does not let PT packs open the door", () => {
    const d = evaluateAccess([m({ kind: "pt", sessionsTotal: 10, sessionsUsed: 2 })], "2026-10-10");
    expect(d.allowed).toBe(false);
    expect(d.standing?.pt?.sessionsLeft).toBe(8);
  });
});

describe("renewals", () => {
  it("starts today when nothing is running", () => expect(nextStartDate([m({ endsOn: "2026-10-05" })], "membership", "2026-10-10")).toBe("2026-10-10"));
  it("stacks after current cover", () => {
    const ms = [m({}), m({ startsOn: "2026-11-01", endsOn: "2026-11-30" })];
    expect(nextStartDate(ms, "membership", "2026-10-20")).toBe("2026-12-01");
  });
});

describe("freeze", () => {
  it("pushes the end date back by the pause length", () => {
    const f = applyFreeze(m({}), "2026-10-10", "2026-10-19");
    expect(f.endsOn).toBe("2026-11-10");
    const frozen = { ...m({}), ...f };
    const d = evaluateAccess([frozen], "2026-10-12");
    expect(!d.allowed && d.reason).toBe("frozen");
  });
  it("ending a pause early gives back the unused days", () => {
    const frozen = { ...m({}), ...applyFreeze(m({}), "2026-10-10", "2026-10-19") };
    const ended = endFreeze(frozen, "2026-10-13");
    expect(ended.frozenUntil).toBe("2026-10-12");
    expect(ended.endsOn).toBe("2026-11-03");
    expect(evaluateAccess([{ ...frozen, ...ended }], "2026-10-13").allowed).toBe(true);
  });
  it("cancelling a pause that hasn't started removes it", () => {
    const frozen = { ...m({}), ...applyFreeze(m({}), "2026-10-10", "2026-10-19") };
    expect(endFreeze(frozen, "2026-10-05")).toEqual({ frozenFrom: null, frozenUntil: null, endsOn: "2026-10-31" });
  });
});

describe("codes", () => {
  it("generates 8 unambiguous characters", () => {
    for (let i = 0; i < 50; i++) expect(generateAccessCode()).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
  });
  it("normalises what scanners and people type", () => {
    expect(normalizeCode(" k7m2-q9px ")).toBe("K7M2Q9PX");
    expect(normalizeCode("ABOI")).toBe("AB01");
  });
  it("formats for reading aloud", () => expect(formatAccessCode("K7M2Q9PX")).toBe("K7M2 Q9PX"));
  it("labels days left", () => {
    expect(daysLeftLabel(0)).toBe("Last day today");
    expect(daysLeftLabel(1)).toBe("Ends tomorrow");
    expect(daysLeftLabel(12)).toBe("12 days left");
  });
});
