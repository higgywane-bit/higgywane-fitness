import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  sub,
  change,
  href,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  /** % vs comparison period */
  change?: number | null;
  href?: string;
  tone?: "warn";
}) {
  const body = (
    <>
      <p className="text-[13px] font-medium text-text-secondary">{label}</p>
      <p className={cn("font-display tabular mt-2 text-[clamp(28px,8.5vw,44px)] leading-none whitespace-nowrap md:text-[52px]", tone === "warn" && "text-energy")}>{value}</p>
      <div className="mt-2 flex min-h-5 flex-wrap items-center gap-x-2 text-[13px] text-text-tertiary">
        {change != null ? (
          <span className={cn("inline-flex items-center gap-0.5 font-semibold", change >= 0 ? "text-success" : "text-red-text")}>
            {change >= 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
            {Math.abs(change)}%
          </span>
        ) : null}
        {sub}
      </div>
    </>
  );
  const cls = "block rounded-3xl border border-hairline bg-surface-1 p-4 md:p-5";
  return href ? (
    <Link href={href} className={cn(cls, "tap hover:border-hairline-strong hover:bg-surface-2")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
