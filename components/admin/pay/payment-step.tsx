"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Banknote, CreditCard, QrCode } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatTHB } from "@/lib/format";
import { promptPayPayload } from "@/lib/payments/promptpay";
import { cn } from "@/lib/utils";

export type DeskPayMethod = "qashier" | "promptpay" | "cash";

const METHODS: { id: DeskPayMethod; label: string; icon: typeof CreditCard }[] = [
  { id: "qashier", label: "Card machine", icon: CreditCard },
  { id: "promptpay", label: "QR code", icon: QrCode },
  { id: "cash", label: "Cash", icon: Banknote },
];

/**
 * How the customer pays at the desk or bar. The Qashier terminal is only the card
 * machine: staff key the amount there, then confirm here. QR = PromptPay for the exact amount.
 */
export function PaymentStep({
  amount,
  method,
  onMethod,
  reference,
  onReference,
  promptPayId,
}: {
  amount: number;
  method: DeskPayMethod;
  onMethod: (m: DeskPayMethod) => void;
  reference: string;
  onReference: (r: string) => void;
  promptPayId: string | null;
}) {
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Payment" className="grid grid-cols-3 gap-2">
        {METHODS.map((m) => {
          const on = method === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onMethod(m.id)}
              className={cn(
                "tap flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl text-[13px] font-semibold transition-colors",
                on ? "bg-white text-black" : "bg-surface-2 text-text-secondary ring-1 ring-hairline-strong ring-inset hover:text-white",
              )}
            >
              <m.icon className="size-5" aria-hidden />
              {m.label}
            </button>
          );
        })}
      </div>

      {method === "qashier" ? (
        <div className="rounded-2xl bg-surface-2 p-4">
          <p className="text-sm text-text-secondary">
            Key <span className="tabular font-semibold text-white">{formatTHB(amount)}</span> into the card machine, then confirm below.
          </p>
          <Input
            aria-label="Receipt number (optional)"
            placeholder="Receipt no. (optional)"
            value={reference}
            onChange={(e) => onReference(e.target.value)}
            className="mt-3 h-11"
            autoComplete="off"
          />
        </div>
      ) : method === "promptpay" ? (
        <PromptPayQr amount={amount} promptPayId={promptPayId} />
      ) : (
        <CashChange amount={amount} />
      )}
    </div>
  );
}

function PromptPayQr({ amount, promptPayId }: { amount: number; promptPayId: string | null }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    if (!promptPayId || amount <= 0) return setSvg("");
    QRCode.toString(promptPayPayload(promptPayId, amount), { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [promptPayId, amount]);

  if (!promptPayId)
    return (
      <p className="rounded-2xl bg-surface-2 p-4 text-sm text-text-secondary">
        Add the gym&apos;s PromptPay number in Admin → Site &amp; content → Business to show a QR here.
      </p>
    );
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-4 text-black">
      <div
        role="img"
        aria-label={`PromptPay QR for ${formatTHB(amount)}`}
        className="size-32 shrink-0 [&>svg]:size-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-[0.18em] text-black/50 uppercase">PromptPay</p>
        <p className="font-display tabular mt-1 text-4xl leading-none">{formatTHB(amount)}</p>
        <p className="mt-2 text-xs text-black/60">Customer scans. Check it landed, then confirm.</p>
      </div>
    </div>
  );
}

function CashChange({ amount }: { amount: number }) {
  const [given, setGiven] = useState("");
  const g = Number(given);
  const change = given && Number.isFinite(g) ? g - amount : null;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4">
      <Input
        aria-label="Cash given"
        inputMode="numeric"
        placeholder="Cash given"
        value={given}
        onChange={(e) => setGiven(e.target.value.replace(/[^\d]/g, ""))}
        className="tabular h-11 flex-1"
      />
      <div className="min-w-24 text-right">
        <p className="text-xs text-text-tertiary">Change</p>
        <p className={cn("tabular text-lg font-semibold", change != null && change < 0 && "text-red-text")}>{change == null ? "—" : formatTHB(change)}</p>
      </div>
    </div>
  );
}
