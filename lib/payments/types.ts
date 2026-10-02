export type PaymentMethod = "promptpay" | "apple-pay" | "counter";

/**
 * pending  – waiting for the customer (QR shown, Apple Pay sheet open)
 * paid     – money received
 * unpaid   – order sent to the counter, charge on the Qashier terminal
 * failed   – declined
 * expired  – QR timed out
 */
export type PaymentStatus = "pending" | "paid" | "unpaid" | "failed" | "expired";

export type PaymentRequest = {
  orderId: string;
  orderNumber: string;
  amount: number; // THB
  method: PaymentMethod;
  customerName: string;
};

export type Payment = {
  id: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  /** EMVCo payload to render as a Thai QR (PromptPay) */
  qrPayload?: string;
  /** ISO time the QR stops being valid */
  expiresAt?: string;
  /** hosted page for 3-D Secure / wallets */
  redirectUrl?: string;
  /** reference to show on the in-store Qashier terminal */
  terminalRef?: string;
};

export interface PaymentProvider {
  readonly name: string;
  createPayment(req: PaymentRequest): Promise<Payment>;
  getStatus(paymentId: string): Promise<Payment>;
}
