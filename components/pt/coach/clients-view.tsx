"use client";

import { useDeferredValue, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus, Users } from "lucide-react";
import { addClientAction, searchAddableAction } from "@/app/coach/actions";
import { inputCls, Segmented, Sheet, toast } from "@/components/pt/controls";
import { Avatar, Button, Empty, Group, Pill, Row, Toned } from "@/components/pt/ui";
import type { ClientListRow } from "@/lib/pt/queries";
import { InviteResultView, type InviteResult } from "./invite-sheet";

type Tab = "active" | "setup" | "archived";

export function ClientsView({ lists, showCoach }: { lists: Record<Tab, ClientListRow[]>; showCoach: boolean }) {
  const [tab, setTab] = useState<Tab>(lists.active.length || !lists.setup.length ? "active" : "setup");
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const rows = lists[tab].filter((r) => !query || r.name.toLowerCase().includes(query));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Segmented
          label="Clients"
          value={tab}
          onChange={setTab}
          className="md:w-[420px]"
          options={[
            { value: "active", label: "Active", count: lists.active.length },
            { value: "setup", label: "To set up", count: lists.setup.length },
            ...(lists.archived.length ? [{ value: "archived" as const, label: "Archived", count: lists.archived.length }] : []),
          ]}
        />
        <div className="relative md:ml-auto md:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-s1-faint" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients" aria-label="Search clients" className={`${inputCls} h-11 pl-10`} />
        </div>
      </div>

      {tab === "setup" && rows.length ? <p className="px-1 text-[14px] text-s1-muted">Sold a PT pack but not on the app yet. Open one to send their link. You can build their plan now; it&apos;s waiting when they join.</p> : null}

      {rows.length ? (
        <Group className="lg:grid lg:grid-cols-2 lg:gap-px lg:bg-s1-hairline lg:[&>*]:bg-s1-surface-2 lg:[&>*+*]:border-t-0">
          {rows.map((r) => (
            <Row
              key={r.id}
              href={`/coach/clients/${r.id}`}
              lead={<Avatar initials={r.initials} photo={r.photoUrl} />}
              title={
                <span className="flex items-center gap-2">
                  <span className="truncate">{r.name}</span>
                  {r.unread ? <span className="size-2 shrink-0 rounded-full bg-s1-pink" aria-label={`${r.unread} new`} /> : null}
                </span>
              }
              sub={
                <>
                  {r.parts.map((p, i) => (
                    <span key={i}>
                      {i ? ". " : ""}
                      <Toned tone={p.tone}>{p.text}</Toned>
                    </span>
                  ))}
                  {showCoach && r.coachName ? <Pill tone="pink" className="ml-2 h-5 align-middle">{r.coachName}</Pill> : null}
                </>
              }
            />
          ))}
        </Group>
      ) : (
        <Empty icon={<Users />} title={query ? "No match" : tab === "active" ? "No clients on the app yet" : tab === "setup" ? "Everyone's set up" : "No archived clients"}>
          {query ? "Try another name." : tab === "active" ? "When the desk sells a PT pack with you as coach, the client lands in To set up and gets their link." : null}
        </Empty>
      )}
    </div>
  );
}

type Candidate = { id: string; name: string; memberNo: number; email: string | null; sessionsLeft: number | null };

export function AddClientButton() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const deferred = useDeferredValue(q);
  const [list, setList] = useState<Candidate[] | null>(null);
  const [done, setDone] = useState<{ name: string; invite: InviteResult | null; clientId: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    let live = true;
    searchAddableAction(deferred).then((res) => live && res.ok && setList(res.data));
    return () => {
      live = false;
    };
  }, [deferred, open]);

  const add = (c: Candidate) =>
    start(async () => {
      const res = await addClientAction(c.id);
      if (!res.ok) return toast.bad(res.error);
      setDone({ name: c.name, invite: res.data.invite, clientId: res.data.clientId });
      router.refresh();
    });

  return (
    <>
      <Button variant="tinted" onClick={() => { setOpen(true); setDone(null); setQ(""); }}>
        <UserPlus className="size-5" aria-hidden /> Add client
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={done ? `${done.name} added` : "Add client"}
        description={done ? undefined : "Members with a PT pack show first. Search for anyone else."}
        footer={
          done ? (
            <Button variant="primary" size="lg" block onClick={() => { setOpen(false); router.push(`/coach/clients/${done.clientId}`); }}>
              Open {done.name.split(" ")[0]}&apos;s page
            </Button>
          ) : undefined
        }
      >
        {done ? (
          done.invite ? (
            <InviteResultView name={done.name} result={done.invite} />
          ) : (
            <p className="rounded-2xl bg-s1-surface-2 p-4 text-[15px]">{done.name} already has the app. They&apos;re in your Active list.</p>
          )
        ) : (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-s1-faint" aria-hidden />
              <input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or phone" aria-label="Search members" className={`${inputCls} pl-10`} />
            </div>
            {list === null ? (
              <p className="py-6 text-center text-s1-muted">Loading…</p>
            ) : list.length ? (
              <Group>
                {list.map((c) => (
                  <button key={c.id} type="button" disabled={pending} onClick={() => add(c)} className="tap flex min-h-[60px] w-full items-center gap-3 px-4 py-2 text-left hover:bg-white/[0.03] disabled:opacity-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold">{c.name}</span>
                      <span className="block text-[13px] text-s1-muted">
                        #{c.memberNo}
                        {c.sessionsLeft != null ? ` · ${c.sessionsLeft} PT sessions left` : " · No PT pack"}
                        {c.email ? "" : " · no email"}
                      </span>
                    </span>
                    <Pill tone="blue">Add</Pill>
                  </button>
                ))}
              </Group>
            ) : (
              <p className="py-6 text-center text-[15px] text-s1-muted">{q ? "No members found." : "No new PT packs waiting. Search by name."}</p>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
