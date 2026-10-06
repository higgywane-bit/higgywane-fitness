"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import { useHydrated } from "@/hooks/use-hydrated";
import { useWorkout } from "@/lib/pt/workout-store";

/** "Resume Chest and Back #1" when a workout was left open on this phone. */
export function ResumeBanner({ clientId }: { clientId: string }) {
  const hydrated = useHydrated();
  const active = useWorkout((s) => s.active);
  if (!hydrated || !active || active.clientId !== clientId) return null;
  const done = active.entries.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
  return (
    <Link href={`/app/workout/${active.dayId}/log`} className="tap flex items-center gap-3 rounded-[20px] bg-s1-blue px-4 py-3.5 text-s1-on-blue">
      <span className="grid size-10 place-items-center rounded-full bg-black/15" aria-hidden>
        <Play className="size-5 fill-current" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-bold">Resume {active.dayName}</span>
        <span className="block text-[14px] text-black/70">
          {done} set{done === 1 ? "" : "s"} logged so far
        </span>
      </span>
    </Link>
  );
}
