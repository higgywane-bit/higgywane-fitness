import { promptPayPayload } from "./promptpay";
import type { Payment, PaymentProvider, PaymentRequest, PaymentStatus } from "./types";

/*
 * Mock provider so the whole checkout works end to end before real accounts exist.
 * Stateless: everything needed to answer getStatus() is encoded in the payment id,
 * so it behaves the same on serverless hosting.
 *
 * Behaviour:
 *  - PromptPay: pending for ~6 s (customer "scans"), then paid; expires after 10 min.
 *  - Apple Pay: paid once authorised.
 *  - Counter:   unpaid, charged on the Qashier terminal at pickup.
 *  - A customer name containing "decline" simulates a failed payment.
 */

// TODO: confirm with owner (real PromptPay ID for the cafe account)
const PROMPTPAY_ID = "0812345678";
const QR_TTL_MS = 10 * 60 * 1000;
const PROMPTPAY_SCAN_MS = 6000;

type Encoded = { method: Payment["method"]; amount: number; created: number; decline: boolean; ref: string };

function encode(e: Encoded) {
  return ["mock", e.method, e.amount, e.created, e.decline ? 1 : 0, e.ref].join("_");
}

function decode(id: string): Encoded {
  const [prefix, method, amount, created, decline, ref] = id.split("_");
  if (prefix !== "mock") throw new Error("Not a mock payment id");
  return { method: method as Payment["method"], amount: Number(amount), created: Number(created), decline: decline === "1", ref };
}

function toPayment(id: string, e: Encoded, now = Date.now()): Payment {
  const age = now - e.created;
  let status: PaymentStatus;
  if (e.method === "counter") status = "unpaid";
  else if (e.decline) status = age > 2500 ? "failed" : "pending";
  else if (e.method === "apple-pay") status = "paid";
  else if (age > QR_TTL_MS) status = "expired";
  else status = age > PROMPTPAY_SCAN_MS ? "paid" : "pending";

  return {
    id,
    method: e.method,
    amount: e.amount,
    status,
    qrPayload: e.method === "promptpay" ? promptPayPayload(PROMPTPAY_ID, e.amount) : undefined,
    expiresAt: e.method === "promptpay" ? new Date(e.created + QR_TTL_MS).toISOString() : undefined,
    terminalRef: e.method === "counter" ? e.ref : undefined,
  };
}

export const mockProvider: PaymentProvider = {
  name: "mock",
  async createPayment(req: PaymentRequest) {
    const e: Encoded = {
      method: req.method,
      amount: req.amount,
      created: Date.now(),
      decline: /decline/i.test(req.customerName),
      ref: req.orderNumber,
    };
    const id = encode(e);
    return toPayment(id, e);
  },
  async getStatus(paymentId: string) {
    return toPayment(paymentId, decode(paymentId));
  },
};
