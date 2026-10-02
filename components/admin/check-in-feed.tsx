import Link from "next/link";
import type { FeedItem } from "@/lib/admin/queries";
import { formatMoment } from "@/lib/membership/dates";
import { cn } from "@/lib/utils";

const REASON: Record<string, string> = {
  expired: "Expired",
  "no-membership": "No plan",
  frozen: "Paused",
  "not-started": "Not started",
  "unknown-code": "Unknown code",
  archived: "Archived",
};

export function CheckInFeed({ items, now }: { items: FeedItem[]; now?: Date }) {
  if (!items.length) return <p className="text-sm text-text-tertiary">No check-ins yet today.</p>;
  return (
    <ul className="divide-y divide-hairline">
      {items.map((c) => {
        const name = c.name ?? (c.code ? `Code ${c.code}` : "Unknown");
        const inner = (
          <>
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", c.allowed ? "bg-success" : "bg-red")} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
            {!c.allowed ? <span className="shrink-0 text-xs font-semibold text-red-text">{REASON[c.reason ?? ""] ?? "Denied"}</span> : null}
            <span className="tabular shrink-0 text-xs text-text-tertiary">{formatMoment(new Date(c.at), now)}</span>
          </>
        );
        return (
          <li key={c.id}>
            {c.memberId ? (
              <Link href={`/admin/members/${c.memberId}`} className="flex min-h-11 items-center gap-3 hover:text-white">
                {inner}
              </Link>
            ) : (
              <div className="flex min-h-11 items-center gap-3">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
