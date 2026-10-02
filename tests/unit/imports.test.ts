import { describe, expect, it } from "vitest";
import { parseCSV, parseLooseDate } from "@/lib/csv";
import { buildDraft, guessMapping, matchPlan } from "@/lib/membership/glofox";
import { categorize, parseAmountSatang, parseQashierCSV } from "@/lib/sales/qashier";

describe("csv", () => {
  it("handles quotes, commas, CRLF and BOM", () => {
    expect(parseCSV('﻿a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
    ]);
  });
  it("detects semicolons", () => expect(parseCSV("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]));
  it("reads dates the way exports write them", () => {
    expect(parseLooseDate("2026-10-03")).toBe("2026-10-03");
    expect(parseLooseDate("03/10/2026")).toBe("2026-10-03");
    expect(parseLooseDate("03/10/2026", false)).toBe("2026-03-10");
    expect(parseLooseDate("10/25/2026")).toBe("2026-10-25");
    expect(parseLooseDate("3 Oct 2026")).toBe("2026-10-03");
    expect(parseLooseDate("Oct 3, 2026 14:00")).toBe("2026-10-03");
    expect(parseLooseDate("03/10/2569")).toBe("2026-10-03");
    expect(parseLooseDate("31/02/2026")).toBe(null);
  });
});

describe("glofox import", () => {
  const headers = ["Member ID", "First Name", "Last Name", "Email", "Phone", "Membership Name", "Membership Expiry Date", "Barcode"];
  it("maps Glofox headers", () => {
    expect(guessMapping(headers)).toMatchObject({ externalId: 0, firstName: 1, lastName: 2, email: 3, phone: 4, planName: 5, expiresOn: 6, cardCode: 7 });
  });
  it("matches plan names", () => {
    expect(matchPlan("3 Months Unlimited")?.id).toBe("3-months");
    expect(matchPlan("Annual Membership")?.id).toBe("12-months");
    expect(matchPlan("Monthly")?.id).toBe("1-month");
    expect(matchPlan("2 week pass")?.id).toBe("2-weeks");
    expect(matchPlan("Day Pass")?.id).toBe("day-pass");
    expect(matchPlan("10 PT sessions")?.id).toBe("pt-10");
    expect(matchPlan("Mystery")).toBe(null);
  });
  it("builds a member with an estimated start", () => {
    const r = buildDraft(["g1", "Nicha", "S", "n@x.com", "081 234 5678", "3 Months", "31/12/2026", "000123"], 2, guessMapping(headers), "2026-10-02");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft.membership).toMatchObject({ planId: "3-months", endsOn: "2026-12-31", startsOn: "2026-10-01", startEstimated: true });
    expect(r.draft.cardCode).toBe("000123");
  });
  it("rejects rows without a name", () => {
    expect(buildDraft(["g1", "", "", "", "", "", "", ""], 5, guessMapping(headers), "2026-10-02")).toEqual({ ok: false, row: 5, error: "No name" });
  });
});

describe("qashier", () => {
  it("parses money", () => {
    expect(parseAmountSatang("฿1,200.50")).toBe(120050);
    expect(parseAmountSatang("1.200,50")).toBe(120050);
    expect(parseAmountSatang("149")).toBe(14900);
  });
  it("categorises", () => {
    expect(categorize("Berry Hype smoothie")).toBe("cafe");
    expect(categorize("3 Months membership")).toBe("membership");
    expect(categorize("10 PT Sessions")).toBe("pt");
  });
  it("merges line items into receipts and skips voids", () => {
    const csv = [
      "Receipt No,Date,Time,Item Name,Total,Payment Method,Status",
      "R1,02/10/2026,07:15,Latte,120,Cash,Completed",
      "R1,02/10/2026,07:15,Berry Hype,149,Cash,Completed",
      "R2,02/10/2026,18:40,1 Month,2200,Card,Completed",
      "R3,02/10/2026,19:00,Latte,120,Card,Voided",
    ].join("\n");
    const { sales, skipped } = parseQashierCSV(csv);
    expect(sales).toHaveLength(2);
    expect(sales[0]).toMatchObject({ externalId: "R1", amountSatang: 26900, category: "cafe" });
    expect(sales[0].occurredAt.toISOString()).toBe("2026-10-02T00:15:00.000Z");
    expect(sales[1].category).toBe("membership");
    expect(skipped).toHaveLength(1);
  });
});
