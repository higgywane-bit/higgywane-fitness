"use client";

import { useEffect, useState, useTransition } from "react";
import { CreditCard, Search } from "lucide-react";
import { linkCodeAction, searchMembersAction } from "@/app/admin/actions";
import { AdminDialog, ErrorText } from "@/components/admin/kit";
import { MemberAvatar } from "@/components/admin/member-avatar";
import { standingLine } from "@/components/admin/member-row";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { MemberListRow } from "@/lib/admin/queries";
import { cn } from "@/lib/utils";
import type { DeskUpdate } from "./quick-pass";

/** Scan or type the membership card's code, pick the member, done: the card works from now on. */
export function LinkCardSheet({ initialCode, onClose, onDone }: { initialCode?: string; onClose: () => void; onDone: (u: DeskUpdate) => void }) {
  const [code, setCode] = useState(initialCode ?? "");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<MemberListRow[]>([]);
  const [picked, setPicked] = useState<MemberListRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return setMatches([]);
    const t = setTimeout(async () => {
      const res = await searchMembersAction(q);
      if (res.ok) setMatches(res.data);
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked || code.trim().length < 3) return;
    setError(null);
    start(async () => {
      const res = await linkCodeAction(picked.id, code);
      if (!res.ok) return setError(res.error);
      onDone(res.data);
    });
  }

  return (
    <AdminDialog open onOpenChange={(o) => !o && onClose()} title="Link a card" description="Scan the card or type its code, then pick the member." className="sm:max-w-lg">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <Label htmlFor="lc-code">Card code</Label>
          <div className="relative">
            <CreditCard className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-text-tertiary" aria-hidden />
            <Input
              id="lc-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
              onKeyDown={(e) => {
                // scanners end with Enter: move on to the member search instead of submitting
                if (e.key === "Enter" && !picked) {
                  e.preventDefault();
                  document.getElementById("lc-search")?.focus();
                }
              }}
              inputMode="numeric"
              autoComplete="off"
              autoFocus={!initialCode}
              maxLength={20}
              placeholder="Scan or type"
              className="tabular h-14 pl-12 font-mono text-xl tracking-[0.3em] placeholder:font-sans placeholder:text-base placeholder:tracking-normal"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="lc-search">Member</Label>
          {picked ? (
            <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
              <MemberAvatar name={picked.name} className="size-10 text-sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {picked.name} <span className="tabular font-normal text-text-tertiary">#{picked.memberNo}</span>
                </p>
                <p className="truncate text-xs text-text-secondary">{standingLine(picked)}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(null)}>
                Change
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-text-tertiary" aria-hidden />
                <Input id="lc-search" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus={!!initialCode} placeholder="Name, phone or #number" className="pl-11" autoComplete="off" />
              </div>
              {matches.length ? (
                <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto" role="listbox" aria-label="Members">
                  {matches.map((m) => (
                    <li key={m.id} role="option" aria-selected={false}>
                      <button
                        type="button"
                        onClick={() => setPicked(m)}
                        className={cn("tap flex min-h-14 w-full items-center gap-3 rounded-xl px-2.5 text-left hover:bg-surface-2")}
                      >
                        <MemberAvatar name={m.name} className="size-9 text-sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {m.name} <span className="tabular font-normal text-text-tertiary">#{m.memberNo}</span>
                          </span>
                          <span className="block truncate text-xs text-text-secondary">{standingLine(m)}</span>
                        </span>
                        <StatusBadge status={m.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>

        <ErrorText error={error} />

        <Button type="submit" size="lg" className="w-full" disabled={!picked || code.trim().length < 3 || pending}>
          {pending ? "Linking…" : "Link card & check in"}
        </Button>
      </form>
    </AdminDialog>
  );
}
