"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeDemoAction, sendRemindersAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function SendRemindersButton({ count, live }: { count: number; live: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <Button
        variant={live ? "primary" : "outline"}
        disabled={pending || !count}
        onClick={() =>
          start(async () => {
            const res = await sendRemindersAction();
            setMsg(res.ok ? `${res.data.sent} ${live ? "sent" : "logged as preview"}${res.data.failed.length ? `, ${res.data.failed.length} failed` : ""}.` : res.error);
            router.refresh();
          })
        }
      >
        {pending ? "Sending…" : live ? `Send ${count} now` : `Mark ${count} as previewed`}
      </Button>
      {msg ? <p className="mt-2 text-sm text-text-secondary">{msg}</p> : null}
    </div>
  );
}

export function RemoveDemoButton({ count }: { count: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  if (!count) return <p className="text-sm text-text-tertiary">No demo data left.</p>;
  return confirm ? (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            await removeDemoAction();
            setConfirm(false);
            router.refresh();
          })
        }
      >
        {pending ? "Removing…" : `Yes, remove ${count} demo members`}
      </Button>
      <Button variant="ghost" onClick={() => setConfirm(false)}>
        Keep
      </Button>
    </div>
  ) : (
    <Button variant="outline" onClick={() => setConfirm(true)}>
      Remove demo data
    </Button>
  );
}
