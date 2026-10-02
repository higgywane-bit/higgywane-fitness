"use client";

import { useState } from "react";
import type { Membership, PTPackage } from "@/lib/pricing";
import { TrainSegmentedControl } from "./segmented-control";
import { MembershipCard } from "./membership-card";
import { PTCard } from "./pt-card";

export function TrainContent({
  memberships: membershipList,
  ptPackages: ptList,
}: {
  memberships: Membership[];
  ptPackages: PTPackage[];
}) {
  const [tab, setTab] = useState<"memberships" | "pt">("memberships");

  return (
    <section className="mx-auto max-w-7xl px-4 md:px-8">
      <TrainSegmentedControl tab={tab} onTabChange={setTab} />

      <div className="mt-8 md:mt-12">
        {tab === "memberships" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {membershipList.map((m) => (
              <MembershipCard key={m.id} membership={m} />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ptList.map((p) => (
              <PTCard key={p.id} package={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
