import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { MemberListRow } from "@/lib/admin/queries";
import { daysLeftLabel, expiredLabel } from "@/lib/membership/access";
import { formatDate } from "@/lib/membership/dates";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "./member-avatar";
import { StatusBadge } from "./status-badge";

/** One-line summary of where a member stands, used across lists. */
export function standingLine(m: Pick<MemberListRow, "status" | "plan" | "daysLeft" | "coverEnds" | "daysSinceExpiry" | "startsOn" | "frozenUntil">) {
  switch (m.status) {
    case "active":
    case "expiring":
      return `${m.plan} · ${daysLeftLabel(m.daysLeft ?? 0)}`;
    case "frozen":
      return `${m.plan} · paused until ${formatDate(m.frozenUntil!)}`;
    case "upcoming":
      return `${m.plan} · starts ${formatDate(m.startsOn!)}`;
    case "expired":
      return `${m.plan} · ${expiredLabel(m.daysSinceExpiry ?? 0).toLowerCase()}`;
    default:
      return "No membership";
  }
}

export function MemberRow({ m, right, sub, className }: { m: MemberListRow; right?: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <Link
      href={`/admin/members/${m.id}`}
      className={cn("tap group flex min-h-16 items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-2", className)}
    >
      <MemberAvatar name={m.name} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold">{m.name}</span>
          <span className="tabular shrink-0 text-xs text-text-tertiary">#{m.memberNo}</span>
        </span>
        <span className="block truncate text-[13px] text-text-secondary">{sub ?? standingLine(m)}</span>
      </span>
      {right ?? <StatusBadge status={m.status} className="hidden sm:inline-flex" />}
      <ChevronRight className="size-4 shrink-0 text-text-tertiary group-hover:text-white" aria-hidden />
    </Link>
  );
}
