"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { MemberListRow } from "@/lib/admin/queries";
import type { MemberStatus } from "@/lib/membership/access";
import { formatMoment } from "@/lib/membership/dates";
import { formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "./member-avatar";
import { standingLine } from "./member-row";
import { StatusBadge } from "./status-badge";

type Filter = "all" | MemberStatus | "archived" | "at-risk";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "expiring", label: "Expiring" },
  { id: "at-risk", label: "At risk" },
  { id: "expired", label: "Expired" },
  { id: "frozen", label: "Paused" },
  { id: "upcoming", label: "Starts soon" },
  { id: "none", label: "No plan" },
  { id: "archived", label: "Archived" },
];
type Sort = "name" | "ending" | "visit" | "newest" | "number";

const PAGE = 60;

export function MembersTable({ rows }: { rows: MemberListRow[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filter = (params.get("status") as Filter) ?? "all";
  const tag = params.get("tag");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [sort, setSort] = useState<Sort>(filter === "expiring" ? "ending" : "name");
  const [limit, setLimit] = useState(PAGE);

  function setFilter(f: Filter) {
    const next = new URLSearchParams(params);
    if (f === "all") next.delete("status");
    else next.set("status", f);
    router.replace(`${pathname}?${next}`, { scroll: false });
    setLimit(PAGE);
    if (f === "expiring") setSort("ending");
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0, archived: 0 };
    for (const r of rows) {
      if (r.archived) c.archived++;
      else {
        c.all++;
        // "Active" includes members who are expiring: they can still train.
        if (r.status === "expiring") c.active = (c.active ?? 0) + 1;
        if (r.atRisk) c["at-risk"] = (c["at-risk"] ?? 0) + 1;
        c[r.status] = (c[r.status] ?? 0) + 1;
      }
    }
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    const code = needle.replace(/[^a-z0-9]/g, "");
    return rows
      .filter((r) => (filter === "archived" ? r.archived : !r.archived))
      .filter((r) => filter === "all" || filter === "archived" || r.status === filter || (filter === "active" && r.status === "expiring") || (filter === "at-risk" && r.atRisk))
      .filter((r) => !tag || r.tags.includes(tag))
      .filter(
        (r) =>
          !needle ||
          r.name.toLowerCase().includes(needle) ||
          r.nickname?.toLowerCase().includes(needle) ||
          r.email?.includes(needle) ||
          (digits.length >= 3 && (r.phone?.includes(digits) || String(r.memberNo).includes(digits))) ||
          (code.length >= 4 && r.codes.some((c) => c.toLowerCase() === code)),
      )
      .sort((a, b) => {
        switch (sort) {
          case "ending":
            return (a.coverEnds ?? a.endedOn ?? "9999").localeCompare(b.coverEnds ?? b.endedOn ?? "9999");
          case "visit":
            return (b.lastVisit ?? "").localeCompare(a.lastVisit ?? "");
          case "newest":
            return b.createdAt.localeCompare(a.createdAt);
          case "number":
            return a.memberNo - b.memberNo;
          default:
            return a.name.localeCompare(b.name);
        }
      });
  }, [rows, filter, q, sort, tag]);

  const allTags = useMemo(() => [...new Set(rows.flatMap((r) => r.tags))].sort(), [rows]);
  function setTag(t: string | null) {
    const next = new URLSearchParams(params);
    if (t) next.set("tag", t);
    else next.delete("tag");
    router.replace(`${pathname}?${next}`, { scroll: false });
  }

  return (
    <div>
      <div className="sticky top-14 z-30 -mx-4 space-y-3 border-b border-hairline bg-black/85 px-4 pt-1 pb-3 backdrop-blur-xl md:-mx-8 md:px-8 lg:top-0 lg:pt-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-text-tertiary" aria-hidden />
            <Input
              type="search"
              aria-label="Search members"
              placeholder="Name, phone, email, #number or code"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setLimit(PAGE);
              }}
              className="pl-11"
            />
          </div>
          <label className="sr-only" htmlFor="member-sort">
            Sort
          </label>
          <select
            id="member-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-12 rounded-2xl border border-hairline-strong bg-surface-2 px-3 text-sm text-white"
          >
            <option value="name">Name A–Z</option>
            <option value="ending">Ending soonest</option>
            <option value="visit">Last visit</option>
            <option value="newest">Newest</option>
            <option value="number">Member #</option>
          </select>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" role="tablist" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "tap inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium",
                filter === f.id ? "bg-white text-black" : "glass text-text-secondary hover:text-white",
              )}
            >
              {f.label}
              <span className={cn("tabular text-xs", filter === f.id ? "text-black/60" : "text-text-tertiary")}>{counts[f.id] ?? 0}</span>
            </button>
          ))}
        </div>
        {allTags.length ? (
          <div className="no-scrollbar -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="Filter by tag">
            <span className="mr-1 shrink-0 text-xs text-text-tertiary">Tags</span>
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tag === t}
                onClick={() => setTag(tag === t ? null : t)}
                className={cn("tap h-8 shrink-0 rounded-full px-3 text-xs font-medium", tag === t ? "bg-white text-black" : "bg-surface-2 text-text-secondary hover:text-white")}
              >
                #{t}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {shown.length ? (
        <>
          {/* header row (desktop) */}
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_20px] gap-4 px-3 pt-4 pb-2 text-xs font-medium text-text-tertiary md:grid">
            <span>Member</span>
            <span>Membership</span>
            <span>Last visit</span>
            <span>Contact</span>
            <span />
          </div>
          <ul className="mt-2 divide-y divide-hairline md:mt-0">
            {shown.slice(0, limit).map((m) => (
              <li key={m.id}>
                <Link
                  href={`/admin/members/${m.id}`}
                  className="tap group grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-1 py-2.5 hover:bg-surface-1 md:grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_20px] md:gap-4 md:px-3"
                >
                  <span className="flex min-w-0 items-center gap-3 max-md:contents">
                    <MemberAvatar name={m.name} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold">{m.name}</span>
                        <span className="tabular shrink-0 text-xs text-text-tertiary">#{m.memberNo}</span>
                      </span>
                      <span className="block truncate text-[13px] text-text-secondary md:hidden">{standingLine(m)}</span>
                      <span className="hidden gap-1.5 text-xs text-text-tertiary md:flex">
                        {m.atRisk ? <span className="font-semibold text-energy">At risk</span> : null}
                        {m.tags.map((t) => (
                          <span key={t}>#{t}</span>
                        ))}
                        {m.source === "glofox" ? <span>From Glofox</span> : null}
                      </span>
                    </span>
                  </span>
                  <span className="hidden min-w-0 items-center gap-2.5 md:flex">
                    <StatusBadge status={m.status} />
                    <span className="truncate text-sm text-text-secondary">{standingLine(m).replace(/^No membership$/, "")}</span>
                  </span>
                  <span className="hidden truncate text-sm text-text-secondary md:block">{m.lastVisit ? formatMoment(new Date(m.lastVisit)) : "—"}</span>
                  <span className="hidden truncate text-sm text-text-secondary md:block">{m.phone ? formatPhone(m.phone) : (m.email ?? "—")}</span>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={m.status} className="md:hidden" />
                    <ChevronRight className="size-4 text-text-tertiary group-hover:text-white" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {shown.length > limit ? (
            <div className="mt-4 flex justify-center">
              <button type="button" onClick={() => setLimit((l) => l + PAGE * 2)} className="tap h-11 rounded-full px-5 text-sm font-semibold glass">
                Show more · {shown.length - limit} left
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="py-16 text-center">
          <p className="font-semibold">No members match.</p>
          <p className="mt-1 text-sm text-text-secondary">Try another search or filter.</p>
        </div>
      )}
    </div>
  );
}
