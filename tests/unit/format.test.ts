import { describe, expect, it } from "vitest";
import { formatTHB, formatTHBDelta } from "@/lib/format";

describe("formatTHB", () => {
  it("formats baht with thousands separators", () => {
    expect(formatTHB(1200)).toBe("฿1,200");
    expect(formatTHB(149)).toBe("฿149");
    expect(formatTHB(27000)).toBe("฿27,000");
  });
  it("formats deltas", () => {
    expect(formatTHBDelta(40)).toBe("+฿40");
    expect(formatTHBDelta(-20)).toBe("-฿20");
    expect(formatTHBDelta(0)).toBe("");
  });
});
