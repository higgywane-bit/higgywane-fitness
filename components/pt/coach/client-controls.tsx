"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Check, MoreHorizontal, RotateCcw, Undo2, UserRoundX } from "lucide-react";
import { logSessionAction, reassignAction, setArchivedAction, setVisibilityAction, undoSessionAction } from "@/app/coach/actions";
import { Sheet, Switch, toast } from "@/components/pt/controls";
import { Button, Card, Group } from "@/components/pt/ui";
import { VISIBILITY_LABELS, type Visibility } from "@/lib/pt/clients";

export function SessionsCard({ clientId, firstName, left, total, endsOn }: { clientId: string; firstName: string; left: number | null; total: number; endsOn: string | null }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const log = (status: "done" | "no-show") =>
    start(async () => {
      const res = await logSessionAction(clientId, status);
      if (!res.ok) return toast.bad(res.error);
      setOpen(false);
      router.refresh();
      toast.good(status === "done" ? "Session logged" : "No-show logged", `${res.data.left} left on ${firstName}'s pack.`);
    });
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className="flex-1">
        <div className="num text-[44px] leading-[46px] font-bold tracking-[-0.03em]">{left ?? "–"}</div>
        <div className="mt-0.5 text-[15px] text-s1-muted">
          {left == null ? "No open PT pack. Sell one at the desk." : `of ${total} PT sessions left`}
          {endsOn && left != null ? <span className="block text-[13px] text-s1-faint">Valid until {new Date(`${endsOn}T12:00:00+07:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span> : null}
        </div>
      </div>
      {left != null ? (
        <Button variant="tinted" onClick={() => setOpen(true)} disabled={left <= 0}>
          <Check className="size-5" aria-hidden /> Log session
        </Button>
      ) : null}
      <Sheet open={open} onOpenChange={setOpen} title="Log a session" description={`Takes one session off ${firstName}'s pack and credits it to you.`}>
        <div className="flex flex-col gap-2.5">
          <Button variant="primary" size="lg" block disabled={pending} onClick={() => log("done")}>
            Trained today
          </Button>
          <Button variant="secondary" size="lg" block disabled={pending} onClick={() => log("no-show")}>
            <UserRoundX className="size-5" aria-hidden /> No-show (still uses the session)
          </Button>
          <Button
            variant="plain"
            disabled={pending || left === total}
            onClick={() =>
              start(async () => {
                const res = await undoSessionAction(clientId);
                if (!res.ok) return toast.bad(res.error);
                setOpen(false);
                router.refresh();
                toast.good("Last session given back");
              })
            }
          >
            <Undo2 className="size-4" aria-hidden /> Undo the last one
          </Button>
        </div>
      </Sheet>
    </Card>
  );
}

export function VisibilitySwitches({ clientId, firstName, initial }: { clientId: string; firstName: string; initial: Visibility }) {
  const [v, setV] = useState(initial);
  const [, start] = useTransition();
  return (
    <Group>
      {VISIBILITY_LABELS.map((item) => (
        <div key={item.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-medium">{item.label}</p>
            {item.hint ? <p className="text-[14px] text-s1-muted">{item.hint}</p> : null}
          </div>
          <Switch
            label={item.label}
            checked={v[item.id]}
            onChange={(on) => {
              const prev = v;
              setV({ ...v, [item.id]: on });
              start(async () => {
                const res = await setVisibilityAction(clientId, { [item.id]: on });
                if (!res.ok) {
                  setV(prev);
                  return toast.bad(res.error);
                }
                toast.good(`${item.label} ${on ? "on" : "off"}`, `${firstName}'s app is updated.`);
              });
            }}
          />
        </div>
      ))}
    </Group>
  );
}

export function ClientMenu({ clientId, name, archived, coaches, currentCoachId }: { clientId: string; name: string; archived: boolean; coaches: { id: string; name: string }[] | null; currentCoachId: string | null }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <Button variant="secondary" size="sm" aria-label="More" onClick={() => setOpen(true)} className="size-11 rounded-full p-0">
        <MoreHorizontal className="size-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title={name}>
        <div className="flex flex-col gap-4">
          {coaches ? (
            <div className="flex flex-col gap-2">
              <p className="px-1 text-[13px] font-semibold text-s1-muted">Coach</p>
              <div className="flex flex-wrap gap-2">
                {coaches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={c.id === currentCoachId}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await reassignAction(clientId, c.id);
                        if (!res.ok) return toast.bad(res.error);
                        toast.good(`Moved to ${c.name}`);
                        router.refresh();
                      })
                    }
                    className={c.id === currentCoachId ? "tap h-10 rounded-full bg-s1-pink px-4 text-[15px] font-semibold text-black" : "tap h-10 rounded-full bg-s1-surface-2 px-4 text-[15px] font-semibold hover:bg-s1-surface-3"}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <Button
            variant={archived ? "tinted" : "danger"}
            size="lg"
            block
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await setArchivedAction(clientId, !archived);
                if (!res.ok) return toast.bad(res.error);
                setOpen(false);
                toast.good(archived ? `${name} is back` : `${name} archived`, archived ? undefined : "They can't sign in to the app. Their history is kept.");
                router.refresh();
              })
            }
          >
            {archived ? <RotateCcw className="size-5" aria-hidden /> : <Archive className="size-5" aria-hidden />}
            {archived ? "Restore client" : "Archive client"}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
