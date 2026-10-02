"use client";

import { AlertCircle, Check, Clock } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatTHB } from "@/lib/format";
import type { Order } from "@/lib/orders";
import type { PaymentStatus } from "@/lib/payments/types";

function useCountdown(until?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!until) return null;
  const ms = Math.max(0, new Date(until).getTime() - now);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return { ms, label: `${m}:${String(s).padStart(2, "0")}` };
}

type Props = {
  order: Order;
  status: PaymentStatus;
  onCancel: () => void;
  onRetry: () => void;
  onPayAtCounter: () => void;
};

export function PromptPayScreen({ order, status, onCancel, onRetry, onPayAtCounter }: Props) {
  const [svg, setSvg] = useState<string>("");
  const countdown = useCountdown(order.payment.expiresAt);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!order.payment.qrPayload) return;
    QRCode.toString(order.payment.qrPayload, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [order.payment.qrPayload]);

  const expired = status === "expired" || countdown?.ms === 0;
  const paid = status === "paid";
  const failed = status === "failed";

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 pt-6 pb-10 text-center md:pt-12">
      <p className="tabular text-sm text-text-secondary">Order {order.number}</p>
      <h1 className="text-statement mt-1 text-[52px] md:text-[64px]">{paid ? "Paid" : "Scan to pay"}</h1>

      <div className="relative mt-6 w-full max-w-[320px] rounded-[28px] bg-white p-5 text-black shadow-[0_30px_80px_-20px_rgb(225_29_72/0.35)]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold tracking-tight">PromptPay</span>
          <span className="tabular text-sm font-bold">{formatTHB(order.subtotal)}</span>
        </div>
        <div className="relative mt-4 aspect-square w-full">
          {svg ? (
            <div
              role="img"
              aria-label={`PromptPay QR code for ${formatTHB(order.subtotal)}`}
              className={`size-full transition-opacity duration-300 [&>svg]:size-full ${expired || paid || failed ? "opacity-10" : ""}`}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <div className="size-full animate-pulse rounded-xl bg-black/5" />
          )}
          {paid ? (
            <motion.div
              initial={reduce ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 20 }}
              className="absolute inset-0 m-auto grid size-24 place-items-center rounded-full bg-success text-white"
            >
              <Check className="size-12" strokeWidth={3} aria-hidden />
            </motion.div>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-black/55">Superfit Cafe</p>
      </div>

      <div className="mt-6 min-h-16" role="status" aria-live="polite">
        {paid ? (
          <p className="text-base font-semibold">Payment received. Sending your order to the bar.</p>
        ) : failed ? (
          <p className="flex items-center justify-center gap-2 text-base font-semibold text-red-text">
            <AlertCircle className="size-5" aria-hidden /> The payment was declined.
          </p>
        ) : expired ? (
          <p className="text-base font-semibold">This code has expired.</p>
        ) : (
          <>
            <p className="flex items-center justify-center gap-2 text-base font-semibold">
              <span className="relative flex size-2.5" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-red" />
              </span>
              Waiting for payment
            </p>
            {countdown ? (
              <p className="tabular mt-1 flex items-center justify-center gap-1.5 text-sm text-text-secondary">
                <Clock className="size-4" aria-hidden /> Code valid for {countdown.label}
              </p>
            ) : null}
          </>
        )}
      </div>

      {!paid ? (
        <p className="mt-2 max-w-xs text-sm text-text-secondary">
          Open your banking app, scan the code and confirm {formatTHB(order.subtotal)}. This screen updates by itself.
        </p>
      ) : null}

      <div className="mt-6 flex w-full flex-col gap-2">
        {failed || expired ? (
          <>
            <Button size="lg" onClick={onRetry}>
              Get a new code
            </Button>
            <Button size="lg" variant="secondary" onClick={onPayAtCounter}>
              Pay at the counter instead
            </Button>
          </>
        ) : null}
        {!paid ? (
          <Button size="lg" variant="ghost" onClick={onCancel}>
            Back to checkout
          </Button>
        ) : null}
      </div>

      {/* TODO: remove once a real provider is connected */}
      <p className="mt-8 rounded-full bg-surface-2 px-4 py-2 text-xs text-text-tertiary">
        Test mode: payment confirms automatically after a few seconds.
      </p>
    </div>
  );
}
