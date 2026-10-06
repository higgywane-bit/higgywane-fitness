"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Inbox, MessageCircle, Phone } from "lucide-react";
import { setLeadStageAction } from "@/app/coach/actions";
import { Segmented, Sheet, toast } from "@/components/pt/controls";
import { Avatar, btn, Empty, Group, Pill } from "@/components/pt/ui";
import { INTERESTS, SOURCES, STAGES } from "@/lib/leads/constants";
import type { LeadStage } from "@/lib/db/schema";
import { initials } from "@/lib/pt/clients";
import { cn } from "@/lib/utils";

export type LeadItem = { id: string; name: string; phone: string | null; email: string | null; lineId: string | null; source: string; interest: string; stage: LeadStage; notes: string | null; createdAt: string };

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 60) return `${Math.max(1, m)}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function LeadsView({ active, archived }: { active: LeadItem[]; archived: LeadItem[] }) {
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [open, setOpen] = useState<LeadItem | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const rows = tab === "active" ? active : archived;

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Leads"
        value={tab}
        onChange={setTab}
        className="md:w-[320px]"
        options={[
          { value: "active", label: "Active", count: active.length },
          { value: "archived", label: "Archived", count: archived.length },
        ]}
      />
      {rows.length ? (
        <Group>
          {rows.map((l) => (
            <button key={l.id} type="button" onClick={() => setOpen(l)} className="tap flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.03]">
              <Avatar initials={initials(l.name)} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[17px] font-medium">{l.name}</span>
                  {l.stage === "new" ? <span className="size-2 shrink-0 rounded-full bg-s1-pink" aria-label="New" /> : null}
                </span>
                <span className="block truncate text-[14px] text-s1-muted">
                  {l.notes || INTERESTS[l.interest as keyof typeof INTERESTS] || l.interest}. {SOURCES[l.source as keyof typeof SOURCES] ?? l.source}
                </span>
              </span>
              <span className="shrink-0 text-[13px] text-s1-faint">{ago(l.createdAt)}</span>
            </button>
          ))}
        </Group>
      ) : (
        <Empty icon={<Inbox />} title={tab === "active" ? "No leads right now" : "Nothing archived"}>
          {tab === "active" ? "When the desk passes you a PT enquiry, it lands here." : null}
        </Empty>
      )}

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)} title={open?.name ?? ""}>
        {open ? (
          <div className="flex flex-col gap-4">
            {open.notes ? <p className="rounded-2xl bg-s1-surface-2 p-4 text-[15px] leading-[21px]">{open.notes}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Pill tone="pink">{INTERESTS[open.interest as keyof typeof INTERESTS] ?? open.interest}</Pill>
              <Pill>{SOURCES[open.source as keyof typeof SOURCES] ?? open.source}</Pill>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {open.phone ? (
                <a href={`tel:${open.phone}`} className={btn({ variant: "secondary", size: "lg", className: "rounded-2xl" })}>
                  <Phone className="size-5" aria-hidden /> Call
                </a>
              ) : null}
              {open.lineId ? (
                <a href={`https://line.me/ti/p/~${encodeURIComponent(open.lineId)}`} target="_blank" rel="noreferrer" className={btn({ variant: "secondary", size: "lg", className: "rounded-2xl" })}>
                  <MessageCircle className="size-5 text-s1-green" aria-hidden /> LINE
                </a>
              ) : null}
              {open.email ? (
                <a href={`mailto:${open.email}`} className={btn({ variant: "secondary", size: "lg", className: "col-span-2 rounded-2xl" })}>
                  {open.email}
                </a>
              ) : null}
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 px-1 text-[13px] font-semibold text-s1-muted">Stage</legend>
              <div className="flex flex-wrap gap-2">
                {STAGES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={open.stage === s.id}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await setLeadStageAction(open.id, s.id);
                        if (!res.ok) return toast.bad(res.error);
                        setOpen({ ...open, stage: s.id });
                        toast.good(`${open.name}: ${s.label}`);
                        router.refresh();
                      })
                    }
                    className={cn("tap h-10 rounded-full px-4 text-[15px] font-semibold", open.stage === s.id ? "bg-white text-black" : "bg-s1-surface-2 text-s1-muted hover:text-white")}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <p className="px-1 text-[13px] text-s1-faint">Joined or Lost moves the lead to Archived. When they buy a PT pack at the desk with you as coach, they appear in Clients.</p>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
