"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import * as D from "@radix-ui/react-dialog";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { ADMIN_NAV, ADMIN_NAV_GROUPS, isAdminActive, MOBILE_TABS } from "./nav";
import { StaffSwitcher, type Acting, type SwitcherStaff } from "./staff-switcher";

export function AdminShell({ children, staff, acting, badges }: { children: React.ReactNode; staff: SwitcherStaff[]; acting: Acting; badges: Record<string, number> }) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const tabs = MOBILE_TABS.map((h) => ADMIN_NAV.find((n) => n.href === h)!);
  const inMore = !tabs.some((t) => isAdminActive(pathname, t.href));

  const groups = (onNavigate?: () => void) => (
    <nav aria-label="Admin" className="space-y-5">
      {ADMIN_NAV_GROUPS.map((g) => (
        <div key={g.label}>
          <p className="mb-1 px-3 text-[11px] font-semibold tracking-[0.14em] text-text-tertiary uppercase">{g.label}</p>
          <ul className="space-y-0.5">
            {g.items.map(({ href, label, icon: Icon }) => {
              const active = isAdminActive(pathname, href);
              const badge = badges[href];
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "tap flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] font-medium",
                      active ? "bg-surface-3 text-white" : "text-text-secondary hover:bg-surface-2 hover:text-white",
                    )}
                  >
                    <Icon className={cn("size-[18px]", active && "text-red-text")} aria-hidden />
                    <span className="flex-1">{label}</span>
                    {badge ? <span className="tabular min-w-5 rounded-full bg-red px-1.5 text-center text-[11px] leading-5 font-bold text-white">{badge}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[244px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-hairline bg-surface-1 px-3 py-5 lg:flex">
        <Link href="/admin" className="tap flex items-center gap-2.5 rounded-xl px-3 py-2" aria-label="Superfit admin home">
          <Logo className="h-5" background="#0d0d0d" />
          <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.14em] text-text-secondary uppercase">Admin</span>
        </Link>
        <div className="no-scrollbar mt-6 flex-1 overflow-y-auto">{groups()}</div>
        <div className="mt-3 space-y-1 border-t border-hairline pt-3">
          <StaffSwitcher staff={staff} acting={acting} />
          <Link href="/" className="tap flex h-9 items-center justify-between rounded-xl px-3 text-sm text-text-tertiary hover:bg-surface-2 hover:text-white">
            View website
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>
      </aside>

      <header className="pt-safe sticky top-0 z-40 border-b border-hairline bg-black/80 backdrop-blur-xl lg:hidden">
        <div className="flex h-14 items-center justify-between gap-2.5 pr-2 pl-4">
          <Link href="/admin" aria-label="Superfit admin home" className="tap -m-2 flex items-center gap-2.5 p-2">
            <Logo className="h-[20px]" />
            <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.14em] text-text-secondary uppercase">Admin</span>
          </Link>
          <div className="w-auto">
            <StaffSwitcher staff={staff} acting={acting} compact />
          </div>
        </div>
      </header>

      <main id="main" className="min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        {children}
      </main>

      <nav aria-label="Admin shortcuts" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-black/85 backdrop-blur-xl lg:hidden">
        <ul className="mx-auto grid h-[4.5rem] max-w-xl grid-cols-5">
          {tabs.map(({ href, label, short, icon: Icon }) => {
            const active = isAdminActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn("tap relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-white" : "text-text-tertiary")}
                >
                  <Icon className={cn("size-[22px]", active && "text-red-text")} aria-hidden />
                  {short ?? label}
                  {badges[href] ? <span className="absolute top-2 right-[calc(50%-20px)] size-2 rounded-full bg-red" aria-label={`${badges[href]} waiting`} /> : null}
                </Link>
              </li>
            );
          })}
          <li>
            <D.Root open={more} onOpenChange={setMore}>
              <D.Trigger asChild>
                <button type="button" className={cn("tap flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium", inMore ? "text-white" : "text-text-tertiary")}>
                  <Menu className={cn("size-[22px]", inMore && "text-red-text")} aria-hidden />
                  More
                </button>
              </D.Trigger>
              <D.Portal>
                <D.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
                <D.Content className="pb-safe fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-[28px] border-t border-hairline-strong bg-surface-1 px-4 pt-3 outline-none data-[state=open]:animate-[sheet-up_260ms_var(--ease-out)]">
                  <div aria-hidden className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20" />
                  <div className="mb-3 flex items-center justify-between">
                    <D.Title className="text-lg font-semibold">Menu</D.Title>
                    <D.Close asChild>
                      <button type="button" aria-label="Close" className="grid size-11 place-items-center rounded-full hover:bg-surface-2">
                        <X className="size-5" />
                      </button>
                    </D.Close>
                  </div>
                  <D.Description className="sr-only">All admin sections</D.Description>
                  <div className="pb-6">{groups(() => setMore(false))}</div>
                </D.Content>
              </D.Portal>
            </D.Root>
          </li>
        </ul>
      </nav>
    </div>
  );
}
