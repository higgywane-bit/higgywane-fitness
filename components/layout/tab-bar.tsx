"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { NAV, isActive } from "./nav";
import { CartTab } from "./cart-button";
import { cn } from "@/lib/utils";

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-black/85 backdrop-blur-xl backdrop-saturate-150 md:hidden"
    >
      <ul className="mx-auto flex h-[var(--tabbar-h)] max-w-lg items-stretch px-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "tap flex min-h-11 flex-1 flex-col items-center justify-center gap-1",
                  active ? "text-white" : "text-text-tertiary",
                )}
              >
                <span className="relative grid h-8 w-14 place-items-center">
                  {active ? (
                    <motion.span
                      layoutId="tab-pill"
                      className="absolute inset-0 rounded-full bg-surface-4"
                      transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    />
                  ) : null}
                  <Icon className="relative size-[22px]" strokeWidth={active ? 2.25 : 1.75} />
                </span>
                <span className={cn("text-[11px]", active ? "font-semibold" : "font-medium")}>{label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex flex-1">
          <CartTab />
        </li>
      </ul>
    </nav>
  );
}
