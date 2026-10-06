"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Bell, ClipboardList, Inbox, LogOut, Users } from "lucide-react";
import { coachInboxAction, coachLogoutAction, markReadAction, setCoachLangAction } from "@/app/coach/actions";
import { Segmented, Sheet, toast } from "@/components/pt/controls";
import { Avatar, Button, Wordmark } from "@/components/pt/ui";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/coach", label: "Clients", icon: Users, match: (p: string) => p === "/coach" || p.startsWith("/coach/clients") },
  { href: "/coach/leads", label: "Leads", icon: Inbox, match: (p: string) => p.startsWith("/coach/leads") },
  { href: "/coach/programs", label: "Programs", icon: ClipboardList, match: (p: string) => p.startsWith("/coach/programs") },
];

type Note = { id: string; clientId: string; title: string; body: string | null; href: string | null; at: string; unread: boolean };

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function NotificationsButton({ unread, className }: { unread: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [, start] = useTransition();
  const router = useRouter();
  const load = () =>
    start(async () => {
      const res = await coachInboxAction();
      if (res.ok) setNotes(res.data);
    });
  return (
    <>
      <button
        type="button"
        aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
        onClick={() => {
          setOpen(true);
          load();
        }}
        className={cn("relative grid size-11 place-items-center rounded-full text-white hover:bg-white/5", className)}
      >
        <Bell className="size-[22px]" />
        {unread ? <span className="num absolute top-1.5 right-1.5 grid min-w-[18px] place-items-center rounded-full bg-s1-pink px-1 text-[11px] font-bold text-black">{unread > 9 ? "9+" : unread}</span> : null}
      </button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Notifications"
        left={
          notes?.some((n) => n.unread) ? (
            <button
              type="button"
              className="px-2 text-[15px] font-semibold text-s1-blue"
              onClick={() =>
                start(async () => {
                  await markReadAction([...new Set(notes.map((n) => n.clientId))]);
                  setNotes(notes.map((n) => ({ ...n, unread: false })));
                  router.refresh();
                })
              }
            >
              Mark all read
            </button>
          ) : undefined
        }
      >
        {notes === null ? (
          <p className="py-8 text-center text-s1-muted">Loading…</p>
        ) : notes.length ? (
          <ul className="flex flex-col gap-1.5">
            {notes.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href ?? `/coach/clients/${n.clientId}`}
                  onClick={() => {
                    setOpen(false);
                    if (n.unread) void markReadAction([n.clientId], [n.id]);
                  }}
                  className={cn("flex gap-3 rounded-2xl p-3.5 hover:bg-s1-surface-3", n.unread ? "bg-s1-surface-2" : "")}
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.unread ? "bg-s1-pink" : "bg-transparent")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{n.title}</span>
                    {n.body ? <span className="mt-0.5 block text-[14px] leading-[19px] text-s1-muted">{n.body}</span> : null}
                  </span>
                  <span className="shrink-0 text-[12px] text-s1-faint">{ago(n.at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-s1-muted">Nothing yet. When clients join, train or send feedback, it shows here.</p>
        )}
      </Sheet>
    </>
  );
}

type ShellInfo = { coach: { name: string; initials: string; role: string }; lang: "en" | "th"; unread: number };
const ShellContext = createContext<ShellInfo | null>(null);

export function CoachShell({ coach, lang, unread, newLeads, children }: { coach: { name: string; initials: string; role: string }; lang: "en" | "th"; unread: number; newLeads: number; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [l, setL] = useState(lang);
  return (
    <ShellContext.Provider value={{ coach, lang, unread }}>
    <div className="min-h-dvh [--s1-tabbar:76px] lg:[--s1-tabbar:0px]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col gap-6 border-r border-s1-hairline bg-s1-surface-1 px-4 py-6 lg:flex">
        <div className="flex items-center justify-between px-2">
          <Wordmark />
          <NotificationsButton unread={unread} />
        </div>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV.map((n) => {
            const on = n.match(path);
            return (
              <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} className={cn("tap flex h-11 items-center gap-3 rounded-2xl px-3 text-[15px] font-semibold transition-colors", on ? "bg-s1-blue-tint text-s1-blue" : "text-s1-muted hover:bg-white/[0.04] hover:text-white")}>
                <n.icon className="size-5" aria-hidden />
                <span className="flex-1">{n.label}</span>
                {n.label === "Leads" && newLeads ? <span className="num grid min-w-5 place-items-center rounded-full bg-s1-pink px-1.5 text-[12px] font-bold text-black">{newLeads}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-2xl bg-s1-surface-2 p-3">
            <Avatar initials={coach.initials} size={36} className="bg-s1-pink-tint text-s1-pink" />
            <div className="min-w-0">
              <p className="text-[12px] text-s1-faint">{coach.role}</p>
              <p className="truncate text-[15px] font-semibold">{coach.name}</p>
            </div>
          </div>
          <Segmented
            label="Library language"
            value={l}
            onChange={async (v) => {
              setL(v);
              await setCoachLangAction(v);
              router.refresh();
            }}
            options={[
              { value: "en", label: "EN" },
              { value: "th", label: "ไทย" },
            ]}
          />
          <form action={coachLogoutAction}>
            <Button type="submit" variant="secondary" block className="justify-start">
              <LogOut className="size-5" aria-hidden /> Log out
            </Button>
          </form>
        </div>
      </aside>

      <div className="pb-[calc(var(--s1-tabbar)+env(safe-area-inset-bottom))] lg:pl-[248px]">{children}</div>

      <nav aria-label="Tabs" className="s1-glass fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-s1-hairline pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.map((n) => {
          const on = n.match(path);
          return (
            <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} className={cn("relative flex h-[60px] flex-col items-center justify-center gap-1 text-[12px] font-medium", on ? "text-s1-blue" : "text-s1-faint")}>
              <n.icon className="size-6" aria-hidden />
              {n.label}
              {n.label === "Leads" && newLeads ? <span className="num absolute top-1.5 left-[calc(50%+6px)] grid min-w-[18px] place-items-center rounded-full bg-s1-pink px-1 text-[11px] font-bold text-black">{newLeads}</span> : null}
            </Link>
          );
        })}
      </nav>
    </div>
    </ShellContext.Provider>
  );
}

/**
 * Page header. Phone: sticky bar with back link (or wordmark), bell and account.
 * Desktop: back link above a large title, actions on the right.
 */
export function CoachHeader({ title, sub, back, actions }: { title: ReactNode; sub?: ReactNode; back?: { href: string; label: string }; actions?: ReactNode }) {
  const info = useContext(ShellContext);
  return (
    <>
      <div className="s1-glass sticky top-0 z-30 flex h-14 items-center justify-between gap-2 px-2 pt-safe lg:hidden">
        {back ? (
          <Link href={back.href} className="flex min-w-0 items-center gap-0.5 px-1.5 text-[17px] text-s1-blue">
            <ChevronLeft className="size-6 shrink-0" aria-hidden />
            <span className="truncate">{back.label}</span>
          </Link>
        ) : (
          <span className="pl-2">
            <Wordmark />
          </span>
        )}
        {info ? (
          <div className="flex items-center gap-1 pr-1">
            <NotificationsButton unread={info.unread} />
            <CoachAccountButton coach={info.coach} lang={info.lang} />
          </div>
        ) : null}
      </div>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-1 px-4 pt-3 lg:px-12 lg:pt-10">
        {back ? (
          <Link href={back.href} className="mb-2 hidden w-fit items-center gap-1 text-[15px] font-medium text-s1-blue hover:underline lg:flex">
            <ChevronLeft className="size-5" aria-hidden />
            {back.label}
          </Link>
        ) : null}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[32px] leading-10 font-bold tracking-[-0.022em] lg:text-[34px]">{title}</h1>
            {sub ? <p className="mt-0.5 text-[15px] text-s1-muted">{sub}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>
    </>
  );
}

export function CoachBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 pt-5 pb-28 lg:px-12 lg:pb-16", className)}>{children}</div>;
}

/** Account sheet for phones (the sidebar has these on desktop). */
export function CoachAccountButton({ coach, lang }: { coach: { name: string; initials: string; role: string }; lang: "en" | "th" }) {
  const [open, setOpen] = useState(false);
  const [l, setL] = useState(lang);
  const router = useRouter();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Account" className="tap rounded-full lg:hidden">
        <Avatar initials={coach.initials} size={36} className="bg-s1-pink-tint text-s1-pink" />
      </button>
      <Sheet open={open} onOpenChange={setOpen} title={coach.name}>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="px-1 text-[13px] font-semibold text-s1-muted">Exercise and cue language</p>
            <Segmented
              label="Language"
              value={l}
              onChange={async (v) => {
                setL(v);
                await setCoachLangAction(v);
                toast.good(v === "th" ? "ภาษาไทย" : "English");
                router.refresh();
              }}
              options={[
                { value: "en", label: "English" },
                { value: "th", label: "ไทย" },
              ]}
            />
          </div>
          <form action={coachLogoutAction}>
            <Button type="submit" variant="danger" size="lg" block>
              <LogOut className="size-5" aria-hidden /> Log out
            </Button>
          </form>
        </div>
      </Sheet>
    </>
  );
}
