import { describe, expect, it, vi } from "vitest";
import { crc16, promptPayPayload } from "@/lib/payments/promptpay";
import { mockProvider } from "@/lib/payments/mock";

describe("PromptPay payload", () => {
  it("uses CRC-16/CCITT-FALSE", () => {
    expect(crc16("123456789")).toBe("29B1");
  });

  it("builds a dynamic THB payload for a phone number", () => {
    const p = promptPayPayload("081-234-5678", 418);
    expect(p.startsWith("000201010212")).toBe(true);
    expect(p).toContain("0016A000000677010111");
    expect(p).toContain("01130066812345678");
    expect(p).toContain("5802TH");
    expect(p).toContain("5303764");
    expect(p).toContain("5406418.00");
    expect(crc16(p.slice(0, -4))).toBe(p.slice(-4));
  });
});

describe("mock provider", () => {
  const req = { orderId: "o1", orderNumber: "SF-1234", amount: 418, customerName: "Nicha" };

  it("PromptPay goes pending → paid", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T10:00:00Z"));
    const p = await mockProvider.createPayment({ ...req, method: "promptpay" });
    expect(p.status).toBe("pending");
    expect(p.qrPayload).toBeTruthy();
    vi.setSystemTime(new Date("2026-10-02T10:00:07Z"));
    expect((await mockProvider.getStatus(p.id)).status).toBe("paid");
    vi.useRealTimers();
  });

  it("counter orders are unpaid with a terminal reference", async () => {
    const p = await mockProvider.createPayment({ ...req, method: "counter" });
    expect(p.status).toBe("unpaid");
    expect(p.terminalRef).toBe("SF-1234");
  });

  it("simulates a decline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T10:00:00Z"));
    const p = await mockProvider.createPayment({ ...req, method: "promptpay", customerName: "decline test" });
    vi.setSystemTime(new Date("2026-10-02T10:00:03Z"));
    expect((await mockProvider.getStatus(p.id)).status).toBe("failed");
    vi.useRealTimers();
  });
});
