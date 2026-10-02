"use client";

import Link from "next/link";
import type { PTPackage } from "@/lib/pricing";
import { formatTHB } from "@/lib/format";

export function PTCard({ package: pkg }: { package: PTPackage }) {
  return (
    <div className="glass flex flex-col rounded-3xl p-5">
      <div className="flex items-start justify-between">
        <p className="font-display tabular text-[56px] leading-none">{pkg.sessions}</p>
        {pkg.saving ? (
          <span className="tabular rounded-full bg-red-tint px-2.5 py-1 text-xs font-semibold text-red-text">
            Save {formatTHB(pkg.saving)}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm font-semibold text-text-secondary">{pkg.sessions === 1 ? "session" : "sessions"}</p>
      <p className="tabular mt-5 text-2xl font-bold">{formatTHB(pkg.price)}</p>
      <p className="tabular text-xs text-text-tertiary">{formatTHB(pkg.perSession)} per session</p>
      <Link
        href="/coaches"
        className="tap mt-5 flex h-12 items-center justify-center gap-1.5 rounded-full bg-white text-[15px] font-semibold text-black hover:bg-white/90"
      >
        Book session{pkg.sessions === 1 ? "" : "s"}
      </Link>
    </div>
  );
}
