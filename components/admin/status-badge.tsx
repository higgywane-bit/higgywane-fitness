import type { MemberStatus } from "@/lib/membership/access";
import { cn } from "@/lib/utils";

/*
 * Status colours are reserved for membership state and always come with a label.
 * green = can train, amber = ending soon, blue = paused, red = can't train.
 */
export const STATUS_META: Record<MemberStatus, { label: string; dot: string; text: string; ring: string }> = {
  active: { label: "Active", dot: "bg-success", text: "text-success", ring: "ring-success/30" },
  expiring: { label: "Expiring", dot: "bg-energy", text: "text-energy", ring: "ring-energy/30" },
  frozen: { label: "Paused", dot: "bg-recovery", text: "text-recovery", ring: "ring-recovery/30" },
  upcoming: { label: "Starts soon", dot: "bg-white/70", text: "text-white", ring: "ring-white/20" },
  expired: { label: "Expired", dot: "bg-red", text: "text-red-text", ring: "ring-red/30" },
  none: { label: "No plan", dot: "bg-white/30", text: "text-text-secondary", ring: "ring-white/10" },
};

export function StatusBadge({ status, className, label }: { status: MemberStatus; className?: string; label?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 text-xs font-semibold ring-1 ring-inset",
        meta.ring,
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", meta.dot)} />
      <span className="text-white/90">{label ?? meta.label}</span>
    </span>
  );
}
