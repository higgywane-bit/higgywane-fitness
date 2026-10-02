"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { ADMIN_NAV, isAdminActive } from "./nav";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[232px_1fr]">
      {/* Desktop / iPad landscape: sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-hairline bg-surface-1 px-3 py-5 lg:flex">
        <Link href="/admin" className="tap flex items-center gap-2.5 rounded-xl px-3 py-2" aria-label="Superfit admin home">
          <Logo className="h-5" background="#0d0d0d" />
          <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.14em] text-text-secondary uppercase">
            Admin
          </span>
        </Link>
        <nav aria-label="Admin" className="mt-8 flex-1">
          <ul className="space-y-1">
            {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
              const active = isAdminActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "tap flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium",
                      active ? "bg-surface-3 text-white" : "text-text-secondary hover:bg-surface-2 hover:text-white",
                    )}
                  >
                    <Icon className={cn("size-[18px]", active && "text-red-text")} aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <Link
          href="/"
          className="tap flex h-10 items-center justify-between rounded-xl px-3 text-sm text-text-tertiary hover:bg-surface-2 hover:text-white"
        >
          View website
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </aside>

      {/* Phone / iPad portrait: top bar + bottom tabs */}
      <header className="pt-safe sticky top-0 z-40 border-b border-hairline bg-black/80 backdrop-blur-xl lg:hidden">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <Link href="/admin" aria-label="Superfit admin home" className="tap -m-2 flex items-center gap-2.5 p-2">
            <Logo className="h-[20px]" />
            <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.14em] text-text-secondary uppercase">
              Admin
            </span>
          </Link>
        </div>
      </header>

      <main id="main" className="min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        {children}
      </main>

      <nav
        aria-label="Admin"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-black/85 backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto grid h-[4.5rem] max-w-xl grid-cols-6">
          {ADMIN_NAV.map(({ href, label, short, icon: Icon }) => {
            const active = isAdminActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "tap flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium",
                    active ? "text-white" : "text-text-tertiary",
                  )}
                >
                  <Icon className={cn("size-[22px]", active && "text-red-text")} aria-hidden />
                  {short ?? label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
