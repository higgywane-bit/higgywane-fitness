"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus, Send, Trash2, Utensils } from "lucide-react";
import { applyTemplateAction, deleteTemplateAction } from "@/app/coach/actions";
import { Segmented, Sheet, toast } from "@/components/pt/controls";
import { Avatar, btn, Button, Empty, Group, Pill, Row } from "@/components/pt/ui";

type Item = { id: string; name: string; sub: string };

export function ProgramsList({ workouts, diets }: { workouts: Item[]; diets: Item[] }) {
  const [tab, setTab] = useState<"workout" | "diet">("workout");
  const rows = tab === "workout" ? workouts : diets;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Programs"
          value={tab}
          onChange={setTab}
          className="w-full md:w-[320px]"
          options={[
            { value: "workout", label: "Workouts", count: workouts.length },
            { value: "diet", label: "Diets", count: diets.length },
          ]}
        />
        <Link href={`/coach/programs/new?kind=${tab}`} className={btn({ variant: "tinted", className: "md:ml-auto" })}>
          <Plus className="size-5" aria-hidden /> New {tab === "workout" ? "workout" : "diet"}
        </Link>
      </div>
      {rows.length ? (
        <Group>
          {rows.map((r) => (
            <Row key={r.id} href={`/coach/programs/${r.id}`} lead={<span className="grid size-10 place-items-center rounded-full bg-s1-surface-3 [&_svg]:size-5">{tab === "workout" ? <ClipboardList /> : <Utensils />}</span>} title={r.name} sub={r.sub} />
          ))}
        </Group>
      ) : (
        <Empty icon={tab === "workout" ? <ClipboardList /> : <Utensils />} title={tab === "workout" ? "No workout programs yet" : "No diets yet"}>
          Build one here, or open a client&apos;s workout and use Programs › Save as program. Then load it for any client in one tap.
        </Empty>
      )}
    </div>
  );
}

export function ProgramActions({ id, name, clients }: { id: string; name: string; clients: { id: string; name: string; initials: string }[] }) {
  const [open, setOpen] = useState<"use" | "delete" | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <Button variant="primary" onClick={() => setOpen("use")} disabled={!clients.length}>
        <Send className="size-4.5" aria-hidden /> Use for a client
      </Button>
      <Button variant="secondary" aria-label="Delete program" onClick={() => setOpen("delete")} className="size-11 p-0">
        <Trash2 className="size-5" />
      </Button>
      <Sheet open={open === "use"} onOpenChange={(o) => setOpen(o ? "use" : null)} title={`Use ${name}`} description="Replaces that client's plan with a copy of this program and sends it to their app.">
        <Group>
          {clients.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await applyTemplateAction(id, c.id);
                  if (!res.ok) return toast.bad(res.error);
                  setOpen(null);
                  toast.good(`${name} sent to ${c.name.split(" ")[0]}`, res.data.notified ? "Their app is updated." : "Ready for when they join.");
                })
              }
              className="tap flex min-h-[58px] w-full items-center gap-3 px-4 py-2 text-left hover:bg-white/[0.03] disabled:opacity-50"
            >
              <Avatar initials={c.initials} size={36} />
              <span className="flex-1 truncate text-[16px] font-semibold">{c.name}</span>
              <Pill tone="blue">Send</Pill>
            </button>
          ))}
        </Group>
      </Sheet>
      <Sheet open={open === "delete"} onOpenChange={(o) => setOpen(o ? "delete" : null)} title={`Delete ${name}?`} description="Clients who already have a copy keep it.">
        <Button
          variant="danger"
          size="lg"
          block
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await deleteTemplateAction(id);
              if (!res.ok) return toast.bad(res.error);
              router.replace("/coach/programs");
              router.refresh();
            })
          }
        >
          Delete program
        </Button>
      </Sheet>
    </>
  );
}
