import Link from "next/link";
import { cn } from "@/lib/utils";

/** Section tabs driven by the URL, so each tab can be linked to. */
export function LinkTabs({ tabs, active, label }: { tabs: { href: string; label: string; id: string; count?: number }[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={active === t.id ? "page" : undefined}
          className={cn("tap inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium", active === t.id ? "bg-white text-black" : "glass text-text-secondary hover:text-white")}
        >
          {t.label}
          {t.count != null ? <span className={cn("tabular text-xs", active === t.id ? "text-black/60" : "text-text-tertiary")}>{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
