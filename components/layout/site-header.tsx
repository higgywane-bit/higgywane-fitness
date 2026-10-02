"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { NAV, isActive } from "./nav";
import { CartHeaderButton } from "./cart-button";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="pt-safe sticky top-0 z-40 border-b border-hairline bg-black/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-[var(--header-h)] max-w-7xl items-center justify-between px-4 md:h-16 md:px-8">
        <Link href="/" aria-label="Superfit home" className="tap -m-2 flex items-center p-2">
          <Logo className="h-[22px] md:h-6" />
        </Link>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV.map(({ href, label }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "tap flex h-11 items-center rounded-full px-4 text-[15px] font-medium",
                      active ? "bg-surface-3 text-white" : "text-text-secondary hover:text-white",
                    )}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hidden md:block">
          <CartHeaderButton />
        </div>
      </div>
    </header>
  );
}
