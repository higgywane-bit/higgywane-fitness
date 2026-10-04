import { describe, expect, it } from "vitest";
import {
  billPaymentPayload,
  billRef,
  checkSlip,
  crc16,
  formatPromptPayId,
  parseTlv,
  promptPayPayload,
  qrAmount,
  readPromptPayId,
  readSlipQr,
  readThaiQr,
  receiverMatches,
  tlv,
  type VerifiedSlip,
} from "@/lib/payments/promptpay";

/** A bank-slip verification QR, built the way bank apps print them. */
function slipQr(bank: string, ref: string) {
  const body = tlv("00", tlv("00", "000001") + tlv("01", bank) + tlv("02", ref)) + tlv("51", "TH") + "9104";
  return body + crc16(body);
}

describe("PromptPay IDs", () => {
  it("reads phones in every common form, tax IDs and e-wallets", () => {
    for (const p of ["0812345678", "081-234-5678", "+66 81 234 5678", "66812345678", "0066812345678"]) {
      expect(readPromptPayId(p)).toEqual({ kind: "phone", id: "0812345678" });
    }
    expect(readPromptPayId("0-1055-12345-67-8")).toEqual({ kind: "national-id", id: "0105512345678" });
    expect(readPromptPayId("140000012345678")).toEqual({ kind: "ewallet", id: "140000012345678" });
    expect(readPromptPayId("0212345678")).toBeNull(); // Bangkok landline, not PromptPay
    expect(readPromptPayId("12345")).toBeNull();
    expect(readPromptPayId("")).toBeNull();
  });

  it("formats IDs for display", () => {
    expect(formatPromptPayId("+66812345678")).toBe("081-234-5678");
    expect(formatPromptPayId("0105512345678")).toBe("0-1055-12345-67-8");
  });
});

describe("PromptPay QR", () => {
  it("uses CRC-16/CCITT-FALSE and matches the reference promptpay-qr payload", () => {
    expect(crc16("123456789")).toBe("29B1");
    // published example from github.com/dtinth/promptpay-qr (different field order, still valid)
    const reference = "00020101021129370016A000000677010111011300660000000005802TH53037646304" + "8956";
    expect(readThaiQr(reference)).toEqual({ ok: true, qr: { kind: "promptpay", target: { kind: "phone", id: "0000000000" }, amount: null, reusable: true } });
  });

  it("builds a one-time THB payload for a phone number", () => {
    const p = promptPayPayload("081-234-5678", 418);
    expect(p.startsWith("000201010212")).toBe(true);
    expect(p).toContain("29370016A000000677010111011300668123456785303764");
    expect(p).toContain("5406418.00");
    expect(p).toContain("5802TH");
    expect(crc16(p.slice(0, -4))).toBe(p.slice(-4));
    expect(readThaiQr(p)).toEqual({ ok: true, qr: { kind: "promptpay", target: { kind: "phone", id: "0812345678" }, amount: 418, reusable: false } });
  });

  it("round-trips tax IDs, e-wallets and the reusable no-amount poster QR", () => {
    const tax = readThaiQr(promptPayPayload("0105512345678", 1200.5));
    expect(tax).toMatchObject({ ok: true, qr: { target: { kind: "national-id", id: "0105512345678" }, amount: 1200.5 } });
    const wallet = readThaiQr(promptPayPayload("140000012345678", 60));
    expect(wallet).toMatchObject({ ok: true, qr: { target: { kind: "ewallet" } } });
    const poster = promptPayPayload("0812345678");
    expect(poster).not.toContain("5406");
    expect(readThaiQr(poster)).toMatchObject({ ok: true, qr: { amount: null, reusable: true } });
  });

  it("refuses bad IDs and amounts instead of making a QR that bank apps reject", () => {
    expect(() => promptPayPayload("12345", 100)).toThrow(/PromptPay/);
    expect(() => qrAmount(0)).toThrow();
    expect(() => qrAmount(-5)).toThrow();
    expect(() => qrAmount(10.555)).toThrow(/2 decimals/);
    expect(() => qrAmount(NaN)).toThrow();
    expect(qrAmount(0.1 + 0.2)).toBe("0.30");
    expect(qrAmount(149)).toBe("149.00");
  });

  it("spots tampered and foreign codes", () => {
    const p = promptPayPayload("0812345678", 418);
    expect(readThaiQr(p.replace("418.00", "1.00"))).toEqual({ ok: false, error: "checksum" });
    expect(readThaiQr("https://superfit.example")).toEqual({ ok: false, error: "checksum" });
    expect(parseTlv("0002")).toBeNull();
  });
});

describe("bill payment QR", () => {
  it("carries the order number as reference so the bank says what was paid", () => {
    const p = billPaymentPayload({ billerId: "010551234567801", ref1: billRef("sf-1042"), ref2: "CAFE", amount: 238, merchantName: "Superfit Cafe" });
    expect(p).toContain("0016A000000677010112");
    expect(readThaiQr(p)).toEqual({
      ok: true,
      qr: { kind: "bill", billerId: "010551234567801", ref1: "SF1042", ref2: "CAFE", amount: 238, reusable: false, merchantName: "Superfit Cafe" },
    });
  });

  it("validates biller ID and references", () => {
    expect(() => billPaymentPayload({ billerId: "0105512345678", ref1: "A" })).toThrow(/15 digits/);
    expect(() => billPaymentPayload({ billerId: "010551234567801", ref1: "sf-1" })).toThrow(/Reference 1/);
    expect(billRef("  SF-1042 / table 4 ")).toBe("SF1042TABLE4");
  });
});

describe("bank slips", () => {
  const ref = "016280123456ABC01234";

  it("reads the slip QR: bank and transaction reference", () => {
    expect(readSlipQr(slipQr("014", ref))).toEqual({ ok: true, slip: { bankCode: "014", bank: "SCB", transRef: ref } });
    expect(readSlipQr(slipQr("999", ref))).toMatchObject({ ok: true, slip: { bank: null } });
  });

  it("tells customers when they scanned the shop's QR instead of their slip", () => {
    expect(readSlipQr(promptPayPayload("0812345678", 100))).toEqual({ ok: false, error: "payment-qr" });
    expect(readSlipQr(slipQr("014", ref).slice(0, -1) + "0")).toEqual({ ok: false, error: "checksum" });
  });

  it("matches masked receivers from the right", () => {
    expect(receiverMatches("xxx-xxx-5678", "081-234-5678")).toBe(true);
    expect(receiverMatches("xxx-xxx-x678", "0812345678")).toBe(true);
    expect(receiverMatches("XXX-XXX-5679", "0812345678")).toBe(false);
    expect(receiverMatches("xxx-xxxx-xx-5678", "+66 81 234 5678")).toBe(true); // 0066 form
    expect(receiverMatches("xxx-x-x5678-x", "123-4-45678-9")).toBe(true);
    expect(receiverMatches("xxx-xxx-xxxx", "0812345678")).toBe(false); // nothing to compare
  });

  const slip: VerifiedSlip = { transRef: ref, amount: 238, paidAt: "2026-10-04T05:03:00Z", receiverAccount: "xxx-xxx-5678" };
  const expectation = { amount: 238, receivers: ["0812345678"], notBefore: "2026-10-04T05:00:00Z", usedRefs: [] as string[] };
  const now = new Date("2026-10-04T05:05:00Z");

  it("accepts a slip for the right amount, to the gym, after the order", () => {
    expect(checkSlip(slip, expectation, now)).toEqual({ ok: true, problems: [] });
    expect(checkSlip({ ...slip, paidAt: "2026-10-04T04:59:00Z" }, expectation, now).ok).toBe(true); // clock grace
  });

  it("names every problem with a bad slip", () => {
    const bad = { ...slip, amount: 23.8, receiverAccount: "xxx-xxx-9999", paidAt: "2026-10-01T05:00:00Z" };
    expect(checkSlip(bad, { ...expectation, usedRefs: [ref] }, now).problems).toEqual(["amount", "receiver", "too-early", "too-old", "already-used"]);
  });
});
