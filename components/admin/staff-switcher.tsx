"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as D from "@radix-ui/react-dialog";
import { Clock, LogIn, LogOut, UserRound, X } from "lucide-react";
import { clockAction, switchStaffAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "./member-avatar";

export type SwitcherStaff = { id: string; name: string; role: string; hasPin: boolean; color: string | null };
export type Acting = { id: string; name: string; clockedInAt: string | null } | null;

/** "Who's working": labels every action with a person, and clocks them in and out. */
export function StaffSwitcher({ staff, acting, compact = false }: { staff: SwitcherStaff[]; acting: Acting; compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<SwitcherStaff | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function choose(s: SwitcherStaff | null) {
    setError(null);
    if (s && s.hasPin) {
      setPicked(s);
      setPin("");
      return;
    }
    submit(s, "");
  }

  function submit(s: SwitcherStaff | null, code: string) {
    start(async () => {
      const res = await switchStaffAction(s?.id ?? null, code);
      if (!res.ok) return setError(res.error);
      setOpen(false);
      setPicked(null);
      router.refresh();
    });
  }

  function clock(direction: "in" | "out") {
    if (!acting) return;
    start(async () => {
      const res = await clockAction(acting.id, direction);
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  }

  const since = acting?.clockedInAt ? new Date(acting.clockedInAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }) : null;

  return (
    <D.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setPicked(null);
        setError(null);
      }}
    >
      <D.Trigger asChild>
        <button
          type="button"
          className={cn(
            "tap flex min-h-11 w-full items-center gap-2.5 rounded-xl text-left hover:bg-surface-2",
            compact ? "px-1.5" : "px-2.5 py-2",
          )}
          aria-label={acting ? `Working: ${acting.name}. Change` : "Who's working?"}
        >
          {acting ? <MemberAvatar name={acting.name} className="size-8 text-xs" /> : <span className="grid size-8 place-items-center rounded-full bg-surface-3"><UserRound className="size-4 text-text-secondary" aria-hidden /></span>}
          {compact ? null : (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{acting ? acting.name : "Who's working?"}</span>
              <span className={cn("block text-xs", since ? "text-success" : "text-text-tertiary")}>{acting ? (since ? `Clocked in ${since}` : "Not clocked in") : "Tap to choose"}</span>
            </span>
          )}
        </button>
      </D.Trigger>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm data-[state=open]:animate-[fade-in_200ms_var(--ease-out)]" />
        <D.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[28px] border border-hairline-strong bg-surface-1 p-5 outline-none data-[state=open]:animate-[dialog-in_260ms_var(--ease-out)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <D.Title className="text-lg font-semibold">{picked ? `Hi ${picked.name.split(" ")[0]}` : "Who's working?"}</D.Title>
              <D.Description className="text-sm text-text-secondary">
                {picked ? "Enter your PIN." : "Everything you do is logged under your name."}
              </D.Description>
            </div>
            <D.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close" className="-mt-1 -mr-2">
                <X className="size-5" />
              </Button>
            </D.Close>
          </div>

          {picked ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(picked, pin);
              }}
              className="space-y-3"
            >
              <Input
                autoFocus
                inputMode="numeric"
                type="password"
                autoComplete="off"
                aria-label="PIN"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="tabular h-14 text-center text-2xl tracking-[0.5em]"
              />
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setPicked(null)}>
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={pending || pin.length < 4}>
                  {pending ? "Checking…" : "Continue"}
                </Button>
              </div>
            </form>
          ) : (
            <>
              {acting ? (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-surface-2 p-3">
                  <span className="flex items-center gap-2 text-sm">
                    <Clock className="size-4 text-text-secondary" aria-hidden />
                    {since ? `${acting.name.split(" ")[0]} clocked in at ${since}` : `${acting.name.split(" ")[0]} isn't clocked in`}
                  </span>
                  <Button size="sm" variant={since ? "outline" : "primary"} disabled={pending} onClick={() => clock(since ? "out" : "in")}>
                    {since ? <LogOut className="size-4" aria-hidden /> : <LogIn className="size-4" aria-hidden />}
                    {since ? "Clock out" : "Clock in"}
                  </Button>
                </div>
              ) : null}
              {staff.length ? (
                <ul className="grid grid-cols-2 gap-2">
                  {staff.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => choose(s)}
                        className={cn("tap flex w-full items-center gap-2.5 rounded-2xl p-2.5 text-left", acting?.id === s.id ? "glass-lit" : "glass hover:bg-white/[0.07]")}
                      >
                        <MemberAvatar name={s.name} className="size-9 text-sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{s.name}</span>
                          <span className="block text-xs text-text-tertiary capitalize">{s.role}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-tertiary">Add staff in Team → Staff first.</p>
              )}
              {acting ? (
                <Button variant="ghost" className="mt-3 w-full" disabled={pending} onClick={() => choose(null)}>
                  Nobody (sign out of this device)
                </Button>
              ) : null}
            </>
          )}
          {error ? (
            <p role="alert" className="mt-3 text-sm font-medium text-red-text">
              {error}
            </p>
          ) : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
