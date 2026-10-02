"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, MessageCircle, Phone, Plus, UserCheck } from "lucide-react";
import {
  addLeadNoteAction,
  convertLeadAction,
  createLeadAction,
  deleteLeadAction,
  leadTimelineAction,
  setLeadStageAction,
  updateLeadAction,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { LeadStage } from "@/lib/db/schema";
import { formatPhone } from "@/lib/format";
import { INTERESTS, SOURCES, STAGES } from "@/lib/leads/constants";
import { formatDate, formatMoment, localDate } from "@/lib/membership/dates";
import { cn } from "@/lib/utils";
import { AdminDialog, ErrorText, Select, useAction } from "./kit";

export type LeadCard = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  lineId: string | null;
  source: string;
  interest: string;
  stage: LeadStage;
  notes: string | null;
  ownerId: string | null;
  ownerName: string | null;
  nextFollowUp: string | null;
  lostReason: string | null;
  memberId: string | null;
  createdAt: string;
  stageChangedAt: string;
};

type StaffOpt = { id: string; name: string };

export function LeadsBoard({ leads, staff }: { leads: LeadCard[]; staff: StaffOpt[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const today = localDate();
  const open = leads.find((l) => l.id === openId) ?? null;
  const columns = STAGES.filter((s) => showClosed || (s.id !== "won" && s.id !== "lost"));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="size-4 accent-[var(--red)]" />
          Show joined and lost
        </label>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden />
          New lead
        </Button>
      </div>

      <div className={cn("grid gap-3", showClosed ? "md:grid-cols-3 xl:grid-cols-5" : "md:grid-cols-3")}>
        {columns.map((s) => {
          const list = leads.filter((l) => l.stage === s.id);
          return (
            <section key={s.id} aria-label={s.label} className="rounded-3xl border border-hairline bg-surface-1 p-3">
              <h2 className="flex items-center justify-between px-1 pt-1 pb-3 text-[15px] font-semibold">
                {s.label}
                <span className="tabular rounded-full bg-surface-3 px-2 py-0.5 text-xs text-text-secondary">{list.length}</span>
              </h2>
              <ul className="space-y-2">
                {list.map((l) => {
                  const due = l.nextFollowUp && l.nextFollowUp <= today && s.id !== "won" && s.id !== "lost";
                  return (
                    <li key={l.id}>
                      <button type="button" onClick={() => setOpenId(l.id)} className="tap w-full rounded-2xl bg-surface-2 p-3 text-left ring-1 ring-hairline ring-inset hover:ring-hairline-strong">
                        <span className="flex items-start justify-between gap-2">
                          <span className="truncate font-semibold">{l.name}</span>
                          <span className="shrink-0 rounded-full bg-black/40 px-2 py-0.5 text-[11px] text-text-secondary">{SOURCES[l.source as keyof typeof SOURCES] ?? l.source}</span>
                        </span>
                        <span className="mt-1 block text-xs text-text-secondary">{INTERESTS[l.interest as keyof typeof INTERESTS] ?? l.interest}{l.ownerName ? ` · ${l.ownerName}` : ""}</span>
                        {l.nextFollowUp && s.id !== "won" && s.id !== "lost" ? (
                          <span className={cn("mt-2 inline-flex items-center gap-1 text-xs font-semibold", due ? "text-energy" : "text-text-tertiary")}>
                            <CalendarClock className="size-3.5" aria-hidden />
                            {l.nextFollowUp < today ? `Follow-up overdue (${formatDate(l.nextFollowUp, today)})` : l.nextFollowUp === today ? "Follow up today" : `Follow up ${formatDate(l.nextFollowUp, today)}`}
                          </span>
                        ) : null}
                        {s.id === "lost" && l.lostReason ? <span className="mt-1 block text-xs text-text-tertiary">{l.lostReason}</span> : null}
                      </button>
                    </li>
                  );
                })}
                {!list.length ? <li className="px-1 py-6 text-center text-sm text-text-tertiary">None</li> : null}
              </ul>
            </section>
          );
        })}
      </div>

      {open ? <LeadDetail lead={open} staff={staff} onClose={() => setOpenId(null)} /> : null}
      <LeadForm open={creating} onOpenChange={setCreating} staff={staff} />
    </div>
  );
}

function LeadDetail({ lead, staff, onClose }: { lead: LeadCard; staff: StaffOpt[]; onClose: () => void }) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [timeline, setTimeline] = useState<{ id: string; type: string; message: string; at: string }[]>([]);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [lost, setLost] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    leadTimelineAction(lead.id).then((r) => r.ok && setTimeline(r.data));
  }, [lead.id, lead.stage]);

  if (editing) return <LeadForm open onOpenChange={(o) => !o && setEditing(false)} staff={staff} lead={lead} />;

  return (
    <AdminDialog open onOpenChange={(o) => !o && onClose()} title={lead.name} description={`${SOURCES[lead.source as keyof typeof SOURCES] ?? lead.source} · ${INTERESTS[lead.interest as keyof typeof INTERESTS] ?? lead.interest} · since ${formatMoment(new Date(lead.createdAt))}`} className="max-w-lg">
      <div className="flex flex-wrap gap-2">
        {lead.phone ? (
          <a href={`tel:${lead.phone}`} className="tap glass inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium">
            <Phone className="size-4" aria-hidden />
            {formatPhone(lead.phone)}
          </a>
        ) : null}
        {lead.lineId ? (
          <a href={`https://line.me/ti/p/~${encodeURIComponent(lead.lineId)}`} target="_blank" rel="noreferrer" className="tap glass inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium">
            <MessageCircle className="size-4" aria-hidden />
            LINE {lead.lineId}
          </a>
        ) : null}
        {lead.email ? <a href={`mailto:${lead.email}`} className="tap glass inline-flex h-10 items-center rounded-full px-4 text-sm font-medium">{lead.email}</a> : null}
      </div>
      {lead.notes ? <p className="mt-4 rounded-2xl bg-surface-2 p-3 text-sm whitespace-pre-wrap text-text-secondary">{lead.notes}</p> : null}

      <h3 className="mt-5 mb-2 text-xs font-semibold tracking-[0.14em] text-text-tertiary uppercase">Stage</h3>
      <div className="flex flex-wrap gap-2">
        {STAGES.filter((s) => s.id !== "won").map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={pending}
            onClick={() => (s.id === "lost" ? setLost(true) : run(() => setLeadStageAction(lead.id, s.id)))}
            className={cn("tap h-9 rounded-full px-3.5 text-sm font-medium", lead.stage === s.id ? "bg-white text-black" : "glass text-text-secondary hover:text-white")}
          >
            {s.label}
          </button>
        ))}
      </div>
      {lost ? (
        <div className="mt-3 flex gap-2">
          <Input placeholder="Why? (price, another gym, no reply…)" value={reason} onChange={(e) => setReason(e.target.value)} className="h-11" />
          <Button disabled={pending} onClick={() => run(() => setLeadStageAction(lead.id, "lost", reason), () => setLost(false))}>
            Mark lost
          </Button>
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl bg-success/10 p-3 ring-1 ring-success/25 ring-inset">
        {lead.memberId ? (
          <Link href={`/admin/members/${lead.memberId}`} className="flex items-center gap-2 text-sm font-semibold text-success">
            <UserCheck className="size-4" aria-hidden />
            Joined: open member profile
          </Link>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">Signing up? Create the member with these details.</p>
            <Button size="sm" disabled={pending} onClick={() => run(() => convertLeadAction(lead.id), (id) => router.push(`/admin/members/${id}?welcome=1&sell=1`))}>
              Convert to member
            </Button>
          </div>
        )}
      </div>

      <h3 className="mt-5 mb-2 text-xs font-semibold tracking-[0.14em] text-text-tertiary uppercase">Notes & history</h3>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addLeadNoteAction(lead.id, note), () => {
            setNote("");
            leadTimelineAction(lead.id).then((r) => r.ok && setTimeline(r.data));
          });
        }}
      >
        <Input placeholder="Called, left a message…" value={note} onChange={(e) => setNote(e.target.value)} className="h-11" />
        <Button type="submit" variant="secondary" disabled={pending || !note.trim()}>
          Add
        </Button>
      </form>
      <ol className="mt-3 space-y-2.5">
        {timeline.map((a) => (
          <li key={a.id} className="flex gap-3 text-sm">
            <span aria-hidden className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", a.type === "lead.note" ? "bg-white" : "bg-white/35")} />
            <span className="flex-1">{a.message}</span>
            <span className="shrink-0 text-xs text-text-tertiary">{formatMoment(new Date(a.at))}</span>
          </li>
        ))}
      </ol>
      <ErrorText error={error} />
      <div className="mt-5 flex justify-between border-t border-hairline pt-4">
        <Button variant="ghost" size="sm" className="text-text-secondary" disabled={pending} onClick={() => run(() => deleteLeadAction(lead.id), onClose)}>
          Delete lead
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Edit details
        </Button>
      </div>
    </AdminDialog>
  );
}

function LeadForm({ open, onOpenChange, staff, lead }: { open: boolean; onOpenChange: (o: boolean) => void; staff: StaffOpt[]; lead?: LeadCard }) {
  const { run, pending, error } = useAction();
  const [v, setV] = useState({
    name: lead?.name ?? "",
    phone: lead?.phone ?? "",
    email: lead?.email ?? "",
    lineId: lead?.lineId ?? "",
    source: lead?.source ?? "walk-in",
    interest: lead?.interest ?? "membership",
    notes: lead?.notes ?? "",
    ownerId: lead?.ownerId ?? "",
    nextFollowUp: lead?.nextFollowUp ?? "",
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <AdminDialog open={open} onOpenChange={onOpenChange} title={lead ? "Edit lead" : "New lead"} description={lead ? undefined : "Someone asked about joining: walk-in, DM, call."} className="max-w-lg">
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => (lead ? updateLeadAction(lead.id, v) : createLeadAction(v)), () => onOpenChange(false));
        }}
      >
        <div className="sm:col-span-2">
          <Label htmlFor="lead-name">Name *</Label>
          <Input id="lead-name" value={v.name} onChange={set("name")} required autoFocus />
        </div>
        <div>
          <Label htmlFor="lead-phone">Phone</Label>
          <Input id="lead-phone" type="tel" value={v.phone} onChange={set("phone")} />
        </div>
        <div>
          <Label htmlFor="lead-line">LINE ID</Label>
          <Input id="lead-line" value={v.lineId} onChange={set("lineId")} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="lead-email">Email</Label>
          <Input id="lead-email" type="email" value={v.email} onChange={set("email")} />
        </div>
        <div>
          <Label htmlFor="lead-source">Came from</Label>
          <Select id="lead-source" value={v.source} onChange={set("source")}>
            {Object.entries(SOURCES).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="lead-interest">Interested in</Label>
          <Select id="lead-interest" value={v.interest} onChange={set("interest")}>
            {Object.entries(INTERESTS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="lead-owner">Followed up by</Label>
          <Select id="lead-owner" value={v.ownerId} onChange={set("ownerId")}>
            <option value="">—</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="lead-follow">Follow up on</Label>
          <Input id="lead-follow" type="date" value={v.nextFollowUp} onChange={set("nextFollowUp")} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="lead-notes">Notes</Label>
          <Textarea id="lead-notes" value={v.notes} onChange={set("notes")} placeholder="Goals, budget, best time to call" />
        </div>
        <div className="sm:col-span-2">
          <ErrorText error={error} />
          <Button type="submit" size="lg" className="w-full" disabled={pending || !v.name.trim()}>
            {pending ? "Saving…" : lead ? "Save" : "Add lead"}
          </Button>
        </div>
      </form>
    </AdminDialog>
  );
}
