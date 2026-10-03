import type { Metadata } from "next";
import { getCatalog } from "@/lib/catalog/server";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { coachList } from "@/lib/catalog";
import { CoachCarousel } from "@/components/coaches/coach-carousel";
import { formatTHB } from "@/lib/format";
import { lowestPerSession } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Coaches",
  description: "Meet the Superfit coaching team: Bella, Nicha, Aun and Poom. Book a PT session or message a coach.",
};

export default async function CoachesPage() {
  await getCatalog();
  return (
    <div className="overflow-x-clip">
      <header className="mx-auto max-w-7xl px-4 pt-5 pb-5 md:px-8 md:pt-12 md:pb-10">
        <p className="text-xs font-semibold tracking-[0.18em] text-text-tertiary uppercase">Supercoach team</p>
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-statement mt-1 text-[52px] md:text-[104px]">Coaches</h1>
          <p className="pb-1.5 text-right text-xs text-text-tertiary md:hidden">Swipe to switch<br />Tap to open</p>
        </div>
        <p className="mt-3 hidden max-w-md text-base text-text-secondary md:block">
          Drag or use the arrows to meet the team. Open a card for the full profile, or book and message right here.
        </p>
      </header>

      <section aria-label="Choose a coach" className="mx-auto max-w-7xl px-4 md:px-8">
        <CoachCarousel coaches={coachList()} />
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-14 pb-16 md:px-8">
        <Link
          href="/train"
          className="tap glass flex items-center justify-between gap-4 rounded-3xl px-5 py-5 md:mx-auto md:max-w-xl"
        >
          <span>
            <span className="block text-xs font-semibold tracking-[0.16em] text-text-tertiary uppercase">1:1 personal training</span>
            <span className="tabular mt-1 block text-[17px] font-semibold">From {formatTHB(lowestPerSession())} per session</span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-text-secondary" aria-hidden />
        </Link>
      </section>
    </div>
  );
}
