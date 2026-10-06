"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, LogOut, X } from "lucide-react";
import { dismissNoticesAction, logoutAction, setLangAction } from "@/app/app/actions";
import { Segmented, Sheet, toast } from "@/components/pt/controls";
import { Avatar, Button } from "@/components/pt/ui";

type Notice = { id: string; title: string; body: string | null; href: string | null; at: string };

/** Updates from the coach ("Bella updated your workout"), each dismissable. */
export function Notices({ notices }: { notices: Notice[] }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const list = notices.filter((n) => !hidden.includes(n.id));
  if (!list.length) return null;
  const dismiss = (ids?: string[]) => {
    setHidden((h) => [...h, ...(ids ?? list.map((n) => n.id))]);
    void dismissNoticesAction(ids);
  };
  return (
    <section aria-label="Updates from your coach" className="flex flex-col gap-2">
      {list.map((n) => (
        <div key={n.id} className="flex items-start gap-3 rounded-[20px] bg-s1-blue-tint p-4 [animation:s1-rise_.35s_ease-out]">
          <BellRing className="mt-0.5 size-5 shrink-0 text-s1-blue" aria-hidden />
          <Link href={n.href ?? "/app"} onClick={() => dismiss([n.id])} className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold text-white">{n.title}</p>
            {n.body ? <p className="mt-0.5 text-[14px] leading-[19px] text-s1-muted">{n.body}</p> : null}
          </Link>
          <button type="button" onClick={() => dismiss([n.id])} aria-label="Dismiss" className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-full text-s1-muted hover:text-white">
            <X className="size-4" />
          </button>
        </div>
      ))}
      {list.length > 1 ? (
        <button type="button" onClick={() => dismiss()} className="self-end px-2 text-[13px] font-semibold text-s1-muted hover:text-white">
          Clear all
        </button>
      ) : null}
    </section>
  );
}

export function AccountButton({ initials, name, email, lang, coachName }: { initials: string; name: string; email: string | null; lang: "en" | "th"; coachName: string | null }) {
  const [open, setOpen] = useState(false);
  const [l, setL] = useState(lang);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Account and settings" className="tap mr-1 rounded-full">
        <Avatar initials={initials} size={36} />
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="Account">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3 rounded-[20px] bg-s1-surface-2 p-4">
            <Avatar initials={initials} size={48} />
            <div className="min-w-0">
              <p className="truncate text-[17px] font-semibold">{name}</p>
              <p className="truncate text-[14px] text-s1-muted">{email}</p>
              {coachName ? <p className="text-[14px] text-s1-pink">Coached by {coachName}</p> : null}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="px-1 text-[13px] font-semibold text-s1-muted">Coaching notes language</p>
            <Segmented
              label="Language"
              value={l}
              onChange={(v) => {
                setL(v);
                start(async () => {
                  const res = await setLangAction(v);
                  if (!res.ok) return toast.bad(res.error);
                  router.refresh();
                });
              }}
              options={[
                { value: "en", label: "English" },
                { value: "th", label: "ไทย" },
              ]}
            />
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="danger" size="lg" block disabled={pending}>
              <LogOut className="size-5" aria-hidden />
              Sign out
            </Button>
          </form>
        </div>
      </Sheet>
    </>
  );
}
