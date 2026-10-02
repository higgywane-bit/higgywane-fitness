import type { Tag as TagId } from "@/content/types";
import { cn } from "@/lib/utils";

export type TagTone = "protein" | "energy" | "recovery" | "neutral";

const DOT: Record<TagTone, string | null> = {
  protein: "bg-red",
  energy: "bg-energy",
  recovery: "bg-recovery",
  neutral: null,
};

export const TAG_META: Record<TagId, { label: string; tone: TagTone }> = {
  "high-protein": { label: "High protein", tone: "protein" },
  "low-cal": { label: "Low cal", tone: "neutral" },
  vegan: { label: "Vegan", tone: "neutral" },
  caffeine: { label: "Caffeine", tone: "energy" },
  "high-caffeine": { label: "High caffeine", tone: "energy" },
  energy: { label: "Energy", tone: "energy" },
  "pre-workout": { label: "Pre-workout", tone: "energy" },
  recovery: { label: "Recovery", tone: "recovery" },
  "post-workout": { label: "Post-workout", tone: "recovery" },
  "best-seller": { label: "Best seller", tone: "neutral" },
  "limited-edition": { label: "Limited", tone: "neutral" },
};

type Props = {
  tone?: TagTone;
  children: React.ReactNode;
  className?: string;
};

export function Tag({ tone = "neutral", children, className }: Props) {
  const dot = DOT[tone];
  return (
    <span
      className={cn(
        "glass inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold tracking-[0.02em] text-white/85 uppercase",
        className,
      )}
    >
      {dot ? <span aria-hidden className={cn("size-1.5 rounded-full", dot)} /> : null}
      {children}
    </span>
  );
}

export function ItemTag({ tag, className }: { tag: TagId; className?: string }) {
  const meta = TAG_META[tag];
  return (
    <Tag tone={meta.tone} className={className}>
      {meta.label}
    </Tag>
  );
}
