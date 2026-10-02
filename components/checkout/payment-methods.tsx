"use client";

import { Check, QrCode, Smartphone, Store } from "lucide-react";
import { useEffect, useState } from "react";
import type { PaymentMethod } from "@/lib/payments/types";
import { cn } from "@/lib/utils";

type ApplePayWindow = Window & { ApplePaySession?: { canMakePayments: () => boolean } };

/** Apple Pay is offered only where the browser supports it; previews show it as simulated. */
export function useApplePay() {
  const [state, setState] = useState<{ available: boolean; simulated: boolean }>({ available: false, simulated: false });
  useEffect(() => {
    const session = (window as ApplePayWindow).ApplePaySession;
    let supported = false;
    try {
      supported = Boolean(session?.canMakePayments());
    } catch {
      supported = false;
    }
    const simulated = !supported && process.env.NODE_ENV !== "production";
    setState({ available: supported || simulated, simulated });
  }, []);
  return state;
}

type MethodInfo = { id: PaymentMethod; title: string; body: string; icon: typeof QrCode };

const METHODS: MethodInfo[] = [
  { id: "promptpay", title: "PromptPay QR", body: "Scan with any Thai banking app", icon: QrCode },
  { id: "apple-pay", title: "Apple Pay", body: "Pay with Face ID or Touch ID", icon: Smartphone },
  { id: "counter", title: "Pay at the counter", body: "Card or cash on the Qashier terminal at pickup", icon: Store },
];

export function PaymentMethods({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (m: PaymentMethod) => void;
}) {
  const applePay = useApplePay();
  const methods = METHODS.filter((m) => m.id !== "apple-pay" || applePay.available);

  return (
    <div role="radiogroup" aria-label="Payment method" className="space-y-2">
      {methods.map(({ id, title, body, icon: Icon }) => {
        const on = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(id)}
            className={cn(
              "tap flex w-full items-center gap-4 rounded-2xl border p-4 text-left",
              on ? "border-white bg-surface-3" : "border-hairline-strong bg-surface-2 hover:border-white/30",
            )}
          >
            <span
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-xl",
                on ? "bg-white text-black" : "bg-surface-4 text-white",
              )}
            >
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[15px] font-semibold">
                {title}
                {id === "apple-pay" && applePay.simulated ? (
                  <span className="rounded-full bg-surface-4 px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                    Simulated
                  </span>
                ) : null}
              </span>
              <span className="block text-sm text-text-secondary">{body}</span>
            </span>
            <span
              aria-hidden
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border",
                on ? "border-red bg-red text-white" : "border-hairline-strong",
              )}
            >
              {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
