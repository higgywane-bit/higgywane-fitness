"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, Camera, CameraOff, CreditCard, Expand, Keyboard, ScanLine, Search, Shrink, Ticket, UserRoundPlus, Volume2, VolumeX } from "lucide-react";
import { checkInAction, deskFeedAction, searchMembersAction } from "@/app/admin/actions";
import { CheckInFeed } from "@/components/admin/check-in-feed";
import { MemberAvatar } from "@/components/admin/member-avatar";
import { standingLine } from "@/components/admin/member-row";
import { SellPlanDialog, type SellTarget } from "@/components/admin/sell-plan-dialog";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Plan } from "@/content/plans";
import type { FeedItem, MemberListRow } from "@/lib/admin/queries";
import { formatTHB } from "@/lib/format";
import { formatDate } from "@/lib/membership/dates";
import type { CheckInMethod, CheckInResult } from "@/lib/membership/service";
import { cn } from "@/lib/utils";
import { CameraScanner } from "./camera-scanner";
import { LinkCardSheet } from "./link-card";
import { QuickPassSheet, type DeskUpdate, type QuickKind } from "./quick-pass";
import { RESULT_MS, ResultOverlay, resultTone } from "./result-overlay";
import { playDeskSound } from "./sounds";

function isTypingTarget(el: EventTarget | null) {
  const e = el as HTMLElement | null;
  return !!e && (e.tagName === "INPUT" || e.tagName === "TEXTAREA" || e.tagName === "SELECT" || e.isContentEditable);
}

type Sheet = { kind: "quick"; quick: QuickKind } | { kind: "link"; code?: string } | { kind: "sell"; target: SellTarget } | null;

export function FrontDesk({
  initialFeed,
  initialCount,
  plans,
  promptPayId,
}: {
  initialFeed: FeedItem[];
  initialCount: number;
  plans: Plan[];
  promptPayId: string | null;
}) {
  const router = useRouter();
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [sold, setSold] = useState<string | null>(null);
  const [feed, setFeed] = useState(initialFeed);
  const [inToday, setInToday] = useState(initialCount);
  const [pending, startTransition] = useTransition();
  const [sound, setSound] = useState(true);
  const [camera, setCamera] = useState(false);
  const [focused, setFocused] = useState(true);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<MemberListRow[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const lastMethod = useRef<CheckInMethod>("scan");
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const show = useCallback((r: CheckInResult, soldLine: string | null = null) => {
    setSold(soldLine);
    setResult(r);
    if (soundRef.current) playDeskSound(resultTone(r, !!soldLine));
  }, []);

  const apply = useCallback(
    (u: DeskUpdate, soldLine: string | null = null) => {
      setFeed(u.feed);
      setInToday(u.inToday);
      show(u.result, soldLine);
    },
    [show],
  );

  // Auto-close: green goes quickly, red stays long enough to act on.
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), RESULT_MS[resultTone(result, !!sold)]);
    return () => clearTimeout(t);
  }, [result, sold]);

  const submit = useCallback(
    (input: { code?: string; memberId?: string; method: CheckInMethod }, soldLine: string | null = null) => {
      lastMethod.current = input.method;
      startTransition(async () => {
        const res = await checkInAction(input);
        if (!res.ok) {
          show({ allowed: false, reason: "unknown-code", at: new Date().toISOString(), code: input.code });
          return;
        }
        apply(res.data, soldLine);
      });
    },
    [apply, show],
  );

  // USB / Bluetooth scanners type the code and press Enter, like a keyboard.
  useEffect(() => {
    let buffer = "";
    let last = 0;
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || sheet || e.metaKey || e.ctrlKey || e.altKey) return;
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
  }, [submit, sheet]);

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

  const price = (id: string) => plans.find((p) => p.id === id)?.price;
  const dayPrice = price("day-pass");
  const weekPrice = price("1-week");

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
            <Button
              variant="ghost"
              size="icon"
              aria-label={sound ? "Mute sounds" : "Turn sounds on"}
              aria-pressed={sound}
              onClick={() => {
                setSound((s) => !s);
                if (!sound) playDeskSound("ok");
              }}
            >
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
        <div className="relative flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-[28px] border border-hairline bg-surface-1 md:min-h-[380px]">
          {camera ? (
            <div className="mx-auto w-full max-w-xl p-4 md:p-6">
              <CameraScanner paused={pending || !!result || !!sheet} onCode={(code) => submit({ code, method: "camera" })} />
              <p className="mt-3 text-center text-sm text-text-secondary">Hold the member&apos;s QR code or card up to the camera.</p>
            </div>
          ) : (
            <Idle pending={pending} />
          )}
        </div>

        {/* quick actions */}
        <div className="grid grid-cols-2 gap-2 md:gap-3 2xl:grid-cols-4">
          <QuickAction icon={Ticket} label="Day pass" sub={dayPrice != null ? formatTHB(dayPrice) : undefined} onClick={() => setSheet({ kind: "quick", quick: "day" })} primary />
          <QuickAction icon={CalendarDays} label="1–2 week pass" sub={weekPrice != null ? `from ${formatTHB(weekPrice)}` : undefined} onClick={() => setSheet({ kind: "quick", quick: "week" })} />
          <QuickAction icon={CreditCard} label="Link card" sub="Scan or 6-digit code" onClick={() => setSheet({ kind: "link" })} />
          <QuickAction icon={UserRoundPlus} label="New member" sub="Full sign-up" href="/admin/members/new" />
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
                placeholder="Type card or member code"
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
            <motion.p key={inToday} initial={{ y: -6, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} className="font-display tabular mt-1 text-[56px] leading-none">
              {inToday}
            </motion.p>
          </div>
          <Link href="/admin" className="text-sm text-text-secondary hover:text-white">
            Dashboard
          </Link>
        </div>
        <div className="mt-5 border-t border-hairline pt-2">
          <CheckInFeed items={feed} />
        </div>
      </aside>

      <AnimatePresence>
        {result ? (
          <ResultOverlay
            key={result.at}
            r={result}
            sold={sold}
            onDismiss={() => setResult(null)}
            onSell={(target) => {
              setResult(null);
              setSheet({ kind: "sell", target });
            }}
            onLinkCard={(code) => {
              setResult(null);
              setSheet({ kind: "link", code });
            }}
            onNewWithCode={(code) => router.push(`/admin/members/new?card=${encodeURIComponent(code)}`)}
          />
        ) : null}
      </AnimatePresence>

      {sheet?.kind === "quick" ? (
        <QuickPassSheet
          kind={sheet.quick}
          plans={plans}
          promptPayId={promptPayId}
          onClose={() => setSheet(null)}
          onDone={(u) => {
            setSheet(null);
            apply(u);
          }}
        />
      ) : null}

      {sheet?.kind === "link" ? (
        <LinkCardSheet
          initialCode={sheet.code}
          onClose={() => setSheet(null)}
          onDone={(u) => {
            setSheet(null);
            apply(u);
          }}
        />
      ) : null}

      {sheet?.kind === "sell" ? (
        <SellPlanDialog
          open
          onOpenChange={(o) => !o && setSheet(null)}
          member={sheet.target}
          onSold={(info) => {
            const target = sheet.target;
            setSheet(null);
            submit({ memberId: target.id, method: lastMethod.current }, `${info.planName} · until ${formatDate(info.endsOn)}`);
          }}
        />
      ) : null}
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  sub,
  onClick,
  href,
  primary,
}: {
  icon: typeof Ticket;
  label: string;
  sub?: string;
  onClick?: () => void;
  href?: string;
  primary?: boolean;
}) {
  const cls = cn(
    "tap group flex min-h-[76px] items-center gap-3 rounded-[22px] px-4 text-left transition-colors",
    primary ? "bg-white text-black hover:bg-white/90" : "border border-hairline bg-surface-1 hover:bg-surface-2",
  );
  const body = (
    <>
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", primary ? "bg-black text-white" : "bg-surface-3 text-white")}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold">{label}</span>
        {sub ? <span className={cn("tabular block truncate text-xs", primary ? "text-black/60" : "text-text-tertiary")}>{sub}</span> : null}
      </span>
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

function Idle({ pending }: { pending: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="relative grid size-36 place-items-center md:size-40">
        <span aria-hidden className="absolute inset-0 animate-[ping_2.4s_cubic-bezier(0,0,0.2,1)_infinite] rounded-[40px] border border-white/15 motion-reduce:animate-none" />
        <span aria-hidden className="absolute inset-3 rounded-[34px] border border-white/10" />
        <span className="glass grid size-24 place-items-center rounded-[30px] md:size-28">
          <ScanLine className={cn("size-11 md:size-12", pending ? "animate-pulse text-red-text" : "text-white")} strokeWidth={1.5} aria-hidden />
        </span>
      </div>
      <div>
        <p className="text-statement text-[40px] md:text-[56px]">{pending ? "Checking…" : "Scan to check in"}</p>
        <p className="mt-2 text-text-secondary">Card, phone QR, or type the code below.</p>
      </div>
    </div>
  );
}
