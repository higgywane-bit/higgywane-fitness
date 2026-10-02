import type { Metadata } from "next";
import Link from "next/link";
import { memberships, ptPackages } from "@/lib/pricing";
import { TrainContent } from "@/components/train/train-content";

export const metadata: Metadata = {
  title: "Train",
  description: "Gym memberships and personal training packages at Superfit Thailand.",
};

export default function TrainPage() {
  const membershipList = memberships();
  const ptList = ptPackages();

  return (
    <div className="overflow-x-clip">
      <header className="mx-auto max-w-7xl px-4 pt-5 pb-5 md:px-8 md:pt-12 md:pb-10">
        <p className="text-xs font-semibold tracking-[0.18em] text-text-tertiary uppercase">Get stronger</p>
        <h1 className="text-statement mt-1 text-[52px] md:text-[104px]">Train</h1>
        <p className="mt-3 hidden max-w-md text-base text-text-secondary md:block">
          Choose your membership or personal training package. Cancel anytime.
        </p>
      </header>

      <TrainContent memberships={membershipList} ptPackages={ptList} />

      <section className="mx-auto max-w-7xl px-4 pt-14 pb-16 md:px-8">
        <div className="glass rounded-3xl p-6 text-center md:p-8">
          <p className="text-sm font-semibold text-text-secondary">Have questions?</p>
          <p className="mt-2 text-[17px] font-semibold md:text-lg">Message a coach for a personalized plan</p>
          <Link
            href="/coaches"
            className="tap mt-4 inline-flex h-12 items-center gap-1.5 rounded-full bg-red px-6 text-sm font-semibold text-white hover:bg-red-hover"
          >
            Chat with coaches
          </Link>
        </div>
      </section>
    </div>
  );
}
