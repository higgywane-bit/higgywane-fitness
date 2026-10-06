"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Delete } from "lucide-react";
import { coachLoginAction } from "@/app/coach/actions";
import { Avatar, Button, Empty } from "@/components/pt/ui";
import { cn } from "@/lib/utils";

type Person = { id: string; name: string; initials: string; role: string; hasPin: boolean };

export function CoachLogin({ people }: { people: Person[] }) {
  const router = useRouter();
  const [who, setWho] = useState<Person | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const signIn = (p: Person, code: string) =>
    start(async () => {
      setError(null);
      const res = await coachLoginAction(p.id, code);
      if (!res.ok) {
        setPin("");
        return setError(res.error);
      }
      router.replace("/coach");
      router.refresh();
    });

  if (!people.length) {
    return (
      <Empty title="No coaches yet">
        Add coaches in the admin under Staff (role: Coach) and give each a PIN.
      </Empty>
    );
  }

  if (!who) {
    return (
      <ul className="grid grid-cols-2 gap-3">
        {people.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => {
                setWho(p);
                setPin("");
                setError(null);
                if (!p.hasPin) signIn(p, "");
              }}
              className="tap flex w-full flex-col items-center gap-2.5 rounded-[20px] bg-s1-surface-2 p-5 hover:bg-s1-surface-3"
            >
              <Avatar initials={p.initials} size={56} className={p.role === "Coach" ? "bg-s1-pink-tint text-s1-pink" : undefined} />
              <span className="text-[17px] font-semibold">{p.name}</span>
              <span className="-mt-2 text-[13px] text-s1-muted">{p.role}</span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  const press = (d: string) => {
    if (pending) return;
    const next = d === "del" ? pin.slice(0, -1) : pin.length < 6 ? pin + d : pin;
    setPin(next);
    setError(null);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <button type="button" onClick={() => setWho(null)} className="flex items-center gap-1 self-start text-[15px] font-medium text-s1-blue">
        <ChevronLeft className="size-5" aria-hidden /> Not {who.name}?
      </button>
      <Avatar initials={who.initials} size={64} />
      <p className="text-[20px] font-semibold">{who.hasPin ? `Hi ${who.name}, your PIN` : `Signing in ${who.name}…`}</p>
      {who.hasPin ? (
        <>
          <div className="flex gap-3" aria-label={`${pin.length} digits entered`}>
            {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
              <span key={i} className={cn("size-3.5 rounded-full transition-colors", i < pin.length ? "bg-s1-blue" : "bg-s1-surface-4")} />
            ))}
          </div>
          {error ? (
            <p role="alert" className="text-[15px] font-medium text-s1-red">
              {error}
            </p>
          ) : null}
          <div className="grid w-full max-w-[300px] grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button key={d} type="button" onClick={() => press(d)} className="tap h-16 rounded-full bg-s1-surface-2 text-[26px] font-semibold hover:bg-s1-surface-3">
                {d}
              </button>
            ))}
            <span />
            <button type="button" onClick={() => press("0")} className="tap h-16 rounded-full bg-s1-surface-2 text-[26px] font-semibold hover:bg-s1-surface-3">
              0
            </button>
            <button type="button" onClick={() => press("del")} aria-label="Delete" className="tap grid h-16 place-items-center rounded-full text-s1-muted hover:text-white">
              <Delete className="size-7" />
            </button>
          </div>
          <Button variant="primary" size="lg" block className="max-w-[300px]" disabled={pin.length < 4 || pending} onClick={() => signIn(who, pin)}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </>
      ) : error ? (
        <p role="alert" className="text-[15px] font-medium text-s1-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
