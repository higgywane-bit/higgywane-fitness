"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { logPtSessionAction, setBookingStatusAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { ErrorText, Select, useAction } from "./kit";

export function BookingButtons({ id, status }: { id: string; status: string }) {
  const { run, pending, error } = useAction();
  return (
    <div>
      <div className="flex flex-wrap justify-end gap-1.5">
        {status === "requested" ? (
          <>
            <Button size="sm" disabled={pending} onClick={() => run(() => setBookingStatusAction(id, "confirmed"))}>
              <Check className="size-3.5" aria-hidden />
              Confirm
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setBookingStatusAction(id, "declined"))}>
              <X className="size-3.5" aria-hidden />
              Decline
            </Button>
          </>
        ) : status === "confirmed" ? (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setBookingStatusAction(id, "done"))}>
            Mark done
          </Button>
        ) : null}
      </div>
      <ErrorText error={error} />
    </div>
  );
}

/** Log a PT session against a pack, credited to a coach. */
export function LogSession({ membershipId, coaches, defaultCoach, left }: { membershipId: string; coaches: { id: string; name: string }[]; defaultCoach?: string | null; left: number }) {
  const [coach, setCoach] = useState(defaultCoach ?? coaches[0]?.id ?? "");
  const { run, pending, error } = useAction();
  return (
    <div>
      <div className="flex items-center gap-2">
        <Select aria-label="Coach" value={coach} onChange={(e) => setCoach(e.target.value)} className="h-10 w-36 rounded-full px-3 text-sm">
          <option value="">No coach</option>
          {coaches.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Button size="sm" disabled={pending || left <= 0} onClick={() => run(() => logPtSessionAction(membershipId, coach || null, "done"))}>
          Log session
        </Button>
        <Button size="sm" variant="ghost" disabled={pending || left <= 0} onClick={() => run(() => logPtSessionAction(membershipId, coach || null, "no-show"))} title="Client didn't turn up; session still used">
          No-show
        </Button>
      </div>
      <ErrorText error={error} />
    </div>
  );
}
