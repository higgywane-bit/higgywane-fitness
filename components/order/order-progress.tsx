"use client";

import { useEffect, useState } from "react";
import { liveOrderStatus } from "@/app/(site)/checkout/actions";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "new", label: "Received" },
  { id: "preparing", label: "Preparing" },
  { id: "ready", label: "Ready" },
] as const;

/** Follows the order on the bar's board, so the customer sees "Ready" without asking. */
export function OrderProgress({ id }: { id: string }) {
  const [status, setStatus] = useState<string>("new");

  useEffect(() => {
    let stop = false;
    async function poll() {
      const res = await liveOrderStatus(id);
      if (!stop && res.ok && res.data) setStatus(res.data.status);
    }
    poll();
    const t = setInterval(poll, 8000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [id]);

  if (status === "cancelled") return <p className="mt-4 text-sm font-semibold text-red-text">This order was cancelled. Ask at the bar.</p>;
  const reached = status === "collected" ? 3 : STEPS.findIndex((s) => s.id === status) + 1;

  return (
    <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="Order progress">
      {STEPS.map((s, i) => {
        const done = i < reached;
        const current = i === reached - 1;
        return (
          <li key={s.id} aria-current={current ? "step" : undefined}>
            <span className={cn("block h-1.5 rounded-full transition-colors duration-500", done ? (s.id === "ready" ? "bg-success" : "bg-white") : "bg-white/10")} />
            <span className={cn("mt-2 block text-xs font-semibold", done ? "text-white" : "text-text-tertiary", current && s.id === "ready" && "text-success")}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
