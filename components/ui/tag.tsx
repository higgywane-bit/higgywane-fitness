import { cn } from "@/lib/utils";

export type TagVariant = "protein" | "energy" | "recovery" | "bestseller" | "limited" | "default";

type Props = {
  variant?: TagVariant;
  children: React.ReactNode;
  className?: string;
};

const variantStyles: Record<TagVariant, string> = {
  protein: "bg-red-tint text-red-text",
  energy: "bg-yellow-tint text-yellow",
  recovery: "bg-blue-tint text-blue",
  bestseller: "bg-surface-3 text-white",
  limited: "bg-surface-3 text-white border border-yellow",
  default: "bg-surface-3 text-text-secondary",
};

export function Tag({ variant = "default", children, className }: Props) {
  return (
    <span className={cn("inline-block rounded-full px-2.5 py-1 text-xs font-semibold", variantStyles[variant], className)}>
      {children}
    </span>
  );
}
