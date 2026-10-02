import "server-only";
import { mockProvider } from "./mock";
import type { PaymentProvider } from "./types";

/*
 * Swap in a real provider here (Opn Payments / 2C2P for PromptPay + Apple Pay,
 * Qashier merchant API for the terminal). Keys stay server-side.
 * TODO: confirm with owner (payment provider accounts)
 */
export function getPaymentProvider(): PaymentProvider {
  return mockProvider;
}

export type * from "./types";
