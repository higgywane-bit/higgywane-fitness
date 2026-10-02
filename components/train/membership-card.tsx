"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Membership } from "@/lib/pricing";
import { formatTHB } from "@/lib/format";

export function MembershipCard({ membership }: { membership: Membership }) {
  return (
    <div className="glass relative flex flex-col rounded-3xl p-5 md:p-6">
      {membership.badge && (
        <span className="absolute top-4 right-4 md:top-5 md:right-5 inline-block rounded-full bg-red-tint px-2.5 py-1 text-xs font-semibold text-red-text">
          {membership.badge}
        </span>
      )}
      <div>
        <h3 className="font-display text-[28px] uppercase leading-none">{membership.name}</h3>
        <p className="mt-2 text-sm text-text-secondary">{membership.description}</p>
      </div>
      <div className="mt-auto flex flex-col gap-4 pt-5">
        <div>
          <p className="tabular text-2xl font-bold">{formatTHB(membership.price)}</p>
          {membership.saving && (
            <p className="tabular text-xs text-text-tertiary">Save {formatTHB(membership.saving)}</p>
          )}
        </div>
        <Link
          href="/coaches"
          className="tap flex h-11 items-center justify-center gap-1.5 rounded-full bg-red text-[15px] font-semibold text-white hover:bg-red-hover"
        >
          Choose <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
