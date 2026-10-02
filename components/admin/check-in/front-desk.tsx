"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Camera,
  CameraOff,
  Check,
  CircleAlert,
  Expand,
  Keyboard,
  ScanLine,
  Search,
  Shrink,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { checkInAction, deskFeedAction, searchMembersAction } from "@/app/admin/actions";
import { CheckInFeed } from "@/components/admin/check-in-feed";
import { MemberAvatar } from "@/components/admin/member-avatar";
import { standingLine } from "@/components/admin/member-row";
import { SellPlanDialog, type SellTarget } from "@/components/admin/sell-plan-dialog";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FeedItem, MemberListRow } from "@/lib/admin/queries";
import { daysLeftLabel, expiredLabel } from "@/lib/membership/access";
import { diffDays, formatDate, formatTime, localDate } from "@/lib/membership/dates";
import type { CheckInMethod, CheckInResult } from "@/lib/membership/service";
import { cn } from "@/lib/utils";
import { CameraScanner } from "./camera-scanner";

const ALLOWED_RESET_MS = 7000;

/* Two short tones: rising = in, low = see the desk. */
function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = ok ? [880, 1320] : [220, 196];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = ok ? "sine" : "square";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.13;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(ok ? 0.25 : 0.08, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.13);
    });
    setTimeout(() => ctx.close(), 600);
  } catch {
    /* no audio: fine */
  }
}

function isTypingTarget(el: EventTarget | null) {
  const e = el as HTMLElement | null;
  return !!e && (e.tagName === "INPUT" || e.tagName === "TEXTAREA" || e.tagName === "SELECT" || e.isContentEditable);
}

export function FrontDesk({ initialFeed, initialCount }: { initialFeed: FeedItem[]; initialCount: number }) {
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [feed, setFeed] = useState(initialFeed);
  const [inToday, setInToday] = useState(initialCount);
  const [pending, startTransition] = useTransition();
  const [sound, setSound] = useState(true);
  const [camera, setCamera] = useState(false);
  const [focused, setFocused] = useState(true);
  const [sell, setSell] = useState<SellTarget | null>(null);
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<MemberListRow[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [sold, setSold] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const lastMethod = useRef<CheckInMethod>("scan");
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const submit = useCallback((input: { code?: string; memberId?: string; method: CheckInMethod }) => {
    lastMethod.current = input.method;
    clearTimeout(resetTimer.current);
    setSold(null);
    startTransition(async () => {
      const res = await checkInAction(input);
      if (!res.ok) {
        setResult({ allowed: false, reason: "unknown-code", at: new Date().toISOString(), code: input.code });
        return;
      }
      const r = res.data.result;
      setResult(r);
      setFeed(res.data.feed);
      setInToday(res.data.inToday);
      if (soundRef.current) beep(r.allowed);
      if (r.allowed && !r.nudge) resetTimer.current = setTimeout(() => setResult(null), ALLOWED_RESET_MS);
    });
  }, []);

  // USB / Bluetooth scanners type the code and press Enter, like a keyboard.
  useEffect(() => {
    let buffer = "";
    let last = 0;
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || sell || e.metaKey || e.ctrlKey || e.altKey) return;
      const now = performance.now();
      if (now - last > 1500) buffer = "";
      last = now;
      if (e.key === "Enter") {
        if (buffer.length >= 3) submit({ code: buffer, method: "scan" });
        buffer = "";
        return;
      }
      if (e.key === "Escape") {
        setResult(null);
        return;
      }
      if (e.key.length === 1) buffer += e.key;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit, sell]);

  // Tell staff when the page can't hear the scanner (another window has focus).
  useEffect(() => {
    const on = () => setFocused(document.hasFocus());
    on();
    window.addEventListener("focus", on);
    window.addEventListener("blur", on);
    return () => {
      window.removeEventListener("focus", on);
      window.removeEventListener("blur", on);
    };
  }, []);

  // Keep the feed fresh when several desks/devices check people in.
  useEffect(() => {
    const id = setInterval(async () => {
      const res = await deskFeedAction();
      if (res.ok) {
        setFeed(res.data.feed);
        setInToday(res.data.inToday);
      }
    }, 20_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setMatches([]);
      return;
    }
    const id = setTimeout(async () => {
      const res = await searchMembersAction(q);
      if (res.ok) setMatches(res.data);
    }, 180);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }

  return (
    <div className="grid min-h-[calc(100dvh-8rem)] gap-4 px-4 pt-4 pb-6 md:px-8 md:pt-6 lg:min-h-dvh lg:grid-cols-[minmax(0,1fr)_340px] lg:py-6">
      <div className="flex min-w-0 flex-col gap-4">
        {/* toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-statement text-[34px] md:text-[44px]">Check-in</h1>
            <span
              className={cn(
                "inline-flex h-7 items-center gap-2 rounded-full px-3 text-xs font-semibold",
                focused ? "bg-success/15 text-success" : "bg-energy/15 text-energy",
              )}
              aria-live="polite"
            >
              <span className={cn("size-1.5 rounded-full", focused ? "animate-pulse bg-success" : "bg-energy")} aria-hidden />
              {focused ? "Scanner ready" : "Tap here to resume scanning"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label={sound ? "Mute sounds" : "Turn sounds on"} aria-pressed={sound} onClick={() => setSound((s) => !s)}>
              {sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            </Button>
            <Button variant="ghost" size="icon" aria-label={camera ? "Turn camera off" : "Scan with camera"} aria-pressed={camera} onClick={() => setCamera((c) => !c)}>
              {camera ? <CameraOff className="size-5" /> : <Camera className="size-5" />}
            </Button>
            <Button variant="ghost" size="icon" aria-label={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen} className="hidden md:inline-flex">
              {fullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}
            </Button>
          </div>
        </div>

        {/* stage */}
        <div className="relative flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-[28px] border border-hairline bg-surface-1">
          <AnimatePresence mode="wait" initial={false}>
            {result ? (
              <motion.div
                key={result.at}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-1 flex-col"
              >
                <ResultView
                  r={result}
                  sold={sold}
                  onDismiss={() => setResult(null)}
                  onSell={(t) => setSell(t)}
                  autoReset={result.allowed && !result.nudge && !reduce}
                />
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-1 flex-col">
                {camera ? (
                  <div className="mx-auto w-full max-w-xl p-4 md:p-6">
                    <CameraScanner paused={pending || !!result} onCode={(code) => submit({ code, method: "camera" })} />
                    <p className="mt-3 text-center text-sm text-text-secondary">Hold the member&apos;s QR code up to the camera.</p>
                  </div>
                ) : (
                  <Idle pending={pending} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* manual entry */}
        <div className="grid gap-3 md:grid-cols-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (typed.trim().length >= 3) submit({ code: typed, method: "typed" });
              setTyped("");
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Keyboard className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-text-tertiary" aria-hidden />
              <Input
                aria-label="Member code"
                placeholder="Type member code"
                value={typed}
                onChange={(e) => setTyped(e.target.value.toUpperCase())}
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={20}
                className="tabular h-14 pl-11 font-mono text-lg tracking-[0.12em] placeholder:font-sans placeholder:text-base placeholder:tracking-normal"
              />
            </div>
            <Button type="submit" size="lg" disabled={typed.trim().length < 3 || pending}>
              Check in
            </Button>
          </form>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-text-tertiary" aria-hidden />
            <Input
              aria-label="Find member by name or phone"
              placeholder="Find by name, phone or #number"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-14 pl-11"
              role="combobox"
              aria-expanded={matches.length > 0}
              aria-controls="desk-search-results"
            />
            {matches.length ? (
              <ul
                id="desk-search-results"
                role="listbox"
                className="absolute inset-x-0 bottom-[calc(100%+8px)] z-20 max-h-80 overflow-y-auto rounded-2xl border border-hairline-strong bg-surface-2 p-1.5 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)]"
              >
                {matches.map((m) => (
                  <li key={m.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onClick={() => {
                        submit({ memberId: m.id, method: "search" });
                        setQuery("");
                        setMatches([]);
                      }}
                      className="tap flex min-h-14 w-full items-center gap-3 rounded-xl px-2.5 text-left hover:bg-surface-3"
                    >
                      <MemberAvatar name={m.name} className="size-9 text-sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {m.name} <span className="tabular font-normal text-text-tertiary">#{m.memberNo}</span>
                        </span>
                        <span className="block truncate text-xs text-text-secondary">{standingLine(m)}</span>
                      </span>
                      <StatusBadge status={m.status} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      {/* today */}
      <aside className="rounded-[28px] border border-hairline bg-surface-1 p-4 md:p-5 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[13px] font-medium text-text-secondary">In today</p>
            <p className="font-display tabular mt-1 text-[56px] leading-none">{inToday}</p>
          </div>
          <Link href="/admin" className="text-sm text-text-secondary hover:text-white">
            Dashboard
          </Link>
        </div>
        <div className="mt-5 border-t border-hairline pt-2">
          <CheckInFeed items={feed} />
        </div>
      </aside>

      {sell ? (
        <SellPlanDialog
          open
          onOpenChange={(o) => !o && setSell(null)}
          member={sell}
          onSold={(info) => {
            submit({ memberId: sell.id, method: lastMethod.current });
            setSold(`${info.planName} sold · runs until ${formatDate(info.endsOn)}`);
          }}
        />
      ) : null}
    </div>
  );
}

function Idle({ pending }: { pending: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="relative grid size-40 place-items-center">
        <span aria-hidden className="absolute inset-0 animate-[ping_2.4s_cubic-bezier(0,0,0.2,1)_infinite] rounded-[40px] border border-white/15" />
        <span aria-hidden className="absolute inset-3 rounded-[34px] border border-white/10" />
        <span className="glass grid size-28 place-items-center rounded-[30px]">
          <ScanLine className={cn("size-12", pending ? "animate-pulse text-red-text" : "text-white")} strokeWidth={1.5} aria-hidden />
        </span>
      </div>
      <div>
        <p className="text-statement text-[40px] md:text-[56px]">{pending ? "Checking…" : "Scan to check in"}</p>
        <p className="mt-2 text-text-secondary">Member QR, old Glofox card, or type the code below.</p>
      </div>
    </div>
  );
}

const DENY_TITLE: Record<string, string> = {
  expired: "Membership expired",
  "no-membership": "No membership",
  frozen: "Membership paused",
  "not-started": "Not started yet",
  "unknown-code": "Code not recognised",
  archived: "Member archived",
};

function ResultView({
  r,
  sold,
  onDismiss,
  onSell,
  autoReset,
}: {
  r: CheckInResult;
  sold: string | null;
  onDismiss: () => void;
  onSell: (t: SellTarget) => void;
  autoReset: boolean;
}) {
  const today = localDate(new Date(r.at));
  const name = r.member ? (r.member.nickname && r.member.nickname !== r.member.name.split(" ")[0] ? `${r.member.name} (${r.member.nickname})` : r.member.name) : null;
  const first = r.member?.nickname || r.member?.name.split(" ")[0];
  const tone = r.duplicate && !sold ? "neutral" : r.allowed ? (r.nudge ? "warn" : "ok") : "deny";
  const sellTarget = r.member ? { id: r.member.id, name: r.member.name, coverEnds: r.coverEnds ?? null } : null;

  const denyDetail = () => {
    switch (r.reason) {
      case "expired":
        return `${r.plan} ${expiredLabel(r.daysSinceExpiry ?? 0).toLowerCase()} (${formatDate(r.endedOn!, today)}).`;
      case "frozen":
        return `Paused until ${formatDate(r.frozenUntil!, today)}. Resume it from their profile to let them in.`;
      case "not-started":
        return `${r.plan} starts ${formatDate(r.startsOn!, today)}.`;
      case "unknown-code":
        return r.code ? `Nobody has code ${r.code}. Find them by name, or link the card on their profile.` : "Try again or find them by name.";
      case "archived":
        return "Restore the member from their profile first.";
      default:
        return "Sell a day pass or membership to let them in.";
    }
  };

  return (
    <div
      className={cn(
        "relative flex flex-1 flex-col",
        tone === "ok" && "bg-[radial-gradient(120%_80%_at_50%_0%,rgb(52_199_89/0.22),transparent_60%)]",
        tone === "warn" && "bg-[radial-gradient(120%_80%_at_50%_0%,rgb(245_208_76/0.2),transparent_60%)]",
        tone === "deny" && "bg-[radial-gradient(120%_80%_at_50%_0%,rgb(225_29_72/0.28),transparent_60%)]",
      )}
      role="status"
      aria-live="assertive"
    >
      <Button variant="ghost" size="icon" onClick={onDismiss} aria-label="Dismiss" className="absolute top-3 right-3 z-10">
        <X className="size-5" />
      </Button>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-5 py-10 text-center md:px-10">
        <div className="relative">
          {r.member ? (
            <MemberAvatar name={r.member.name} photoUrl={r.member.photoUrl} className="size-28 text-[40px] md:size-32" />
          ) : (
            <span className="grid size-28 place-items-center rounded-full bg-surface-3 md:size-32">
              <CircleAlert className="size-12 text-red-text" aria-hidden />
            </span>
          )}
          <span
            className={cn(
              "absolute -right-1 -bottom-1 grid size-11 place-items-center rounded-full ring-4 ring-surface-1",
              tone === "ok" && "bg-success text-black",
              tone === "warn" && "bg-energy text-black",
              tone === "deny" && "bg-red text-white",
              tone === "neutral" && "bg-white text-black",
            )}
            aria-hidden
          >
            {tone === "deny" ? <X className="size-6" strokeWidth={3} /> : <Check className="size-6" strokeWidth={3} />}
          </span>
        </div>

        <div className="max-w-2xl">
          <p className={cn("text-sm font-bold tracking-[0.2em] uppercase", tone === "deny" ? "text-red-text" : tone === "warn" ? "text-energy" : tone === "ok" ? "text-success" : "text-text-secondary")}>
            {sold ? "Renewed · welcome back" : r.duplicate ? "Already checked in" : r.allowed ? "Welcome back" : DENY_TITLE[r.reason ?? ""]}
          </p>
          <h2 className="text-statement mt-2 text-[48px] break-words md:text-[76px]">{r.allowed ? first : (name ?? "Unknown")}</h2>
          {r.member ? (
            <p className="mt-2 text-text-secondary">
              {r.allowed ? `${name} · ` : ""}#{r.member.memberNo}
              {r.plan && r.allowed ? ` · ${r.plan}` : ""}
            </p>
          ) : null}
          {!r.allowed ? <p className="mx-auto mt-4 max-w-md text-lg text-white/90">{denyDetail()}</p> : null}
          {sold ? (
            <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-success/15 px-4 py-2 text-sm font-semibold text-success">
              <Check className="size-4" strokeWidth={3} aria-hidden />
              {sold}
            </p>
          ) : null}
        </div>

        {r.allowed ? (
          <dl className="grid w-full max-w-2xl grid-cols-3 gap-2 md:gap-3">
            <Stat
              label={r.daysLeft === 0 ? "Ends" : "Days left"}
              value={r.daysLeft === 0 ? "Today" : String(r.daysLeft)}
              sub={`until ${formatDate(r.coverEnds!, today)}`}
              warn={!!r.nudge}
            />
            <Stat label="This month" value={String(r.visitsThisMonth ?? 0)} sub={r.visitsThisMonth === 1 ? "visit" : "visits"} />
            {r.pt ? (
              <Stat label="PT left" value={String(r.pt.sessionsLeft)} sub={`until ${formatDate(r.pt.endsOn, today)}`} />
            ) : (
              r.duplicate ? (
                <Stat label="Checked in" value="Today" sub={r.previousVisit ? `at ${formatTime(new Date(r.previousVisit))}` : ""} />
              ) : (
                <LastVisit at={r.previousVisit} today={today} />
              )
            )}
          </dl>
        ) : null}

        {r.allowed && r.nudge ? (
          <div className="flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 rounded-2xl bg-energy/12 p-4 text-left ring-1 ring-energy/30 ring-inset">
            <p className="font-semibold text-energy">{daysLeftLabel(r.daysLeft ?? 0)}. Ask {first} about renewing.</p>
            {sellTarget ? (
              <Button variant="inverse" onClick={() => onSell(sellTarget)}>
                Renew now
              </Button>
            ) : null}
          </div>
        ) : null}

        {!r.allowed ? (
          <div className="flex flex-wrap justify-center gap-2">
            {sellTarget && r.reason !== "archived" && r.reason !== "frozen" ? (
              <Button size="lg" onClick={() => onSell(sellTarget)}>
                {r.reason === "expired" ? "Renew membership" : "Sell a plan"}
              </Button>
            ) : null}
            {r.member ? (
              <Button asChild size="lg" variant="outline">
                <Link href={`/admin/members/${r.member.id}`}>Open profile</Link>
              </Button>
            ) : (
              <Button asChild size="lg" variant="outline">
                <Link href="/admin/members/new">New member</Link>
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {autoReset ? (
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 origin-left animate-[desk-reset_7s_linear_forwards] bg-success/70" />
      ) : null}
    </div>
  );
}

function LastVisit({ at, today }: { at?: string; today: string }) {
  if (!at) return <Stat label="Last visit" value="New" sub="first visit" />;
  const day = localDate(new Date(at));
  const gap = diffDays(day, today);
  return gap === 0 ? (
    <Stat label="Last visit" value="Today" sub={formatTime(new Date(at))} />
  ) : (
    <Stat label="Last visit" value={String(gap)} sub={`${gap === 1 ? "day" : "days"} ago · ${formatDate(day, today)}`} />
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className="glass rounded-2xl px-3 py-4 md:px-4">
      <dt className="text-xs font-medium text-text-secondary">{label}</dt>
      <dd className={cn("font-display tabular mt-1 text-[40px] leading-none md:text-[56px]", warn && "text-energy")}>{value}</dd>
      <dd className="mt-1.5 truncate text-xs text-text-tertiary">{sub}</dd>
    </div>
  );
}
