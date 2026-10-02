import { cn } from "@/lib/utils";

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase() || "?";
}

export function MemberAvatar({ name, photoUrl, className }: { name: string; photoUrl?: string | null; className?: string }) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" className={cn("size-10 shrink-0 rounded-full object-cover", className)} />;
  }
  return (
    <span
      aria-hidden
      className={cn(
        "font-display grid size-10 shrink-0 place-items-center rounded-full bg-surface-3 text-[15px] tracking-wide text-white ring-1 ring-hairline-strong ring-inset",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
