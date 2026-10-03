"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { BellRing, CreditCard, RotateCcw, UserRound, UserRoundPlus } from "lucide-react";
import { MemberAvatar } from "@/components/admin/member-avatar";
import type { SellTarget } from "@/components/admin/sell-plan-dialog";
import { expiredLabel } from "@/lib/membership/access";
import { formatDate, localDate } from "@/lib/membership/dates";
import type { CheckInResult } from "@/lib/membership/service";
import { cn } from "@/lib/utils";
import type { DeskSound } from "./sounds";

export type DeskTone = DeskSound;

export function resultTone(r: CheckInResult, sold: boolean): DeskTone {
  if (sold) return "ok";
  if (r.duplicate) return "neutral";
  if (!r.allowed) return "deny";
  return r.nudge ? "warn" : "ok";
}

/** How long each result stays up before the desk goes back to "scan". */
export const RESULT_MS: Record<DeskTone, number> = { ok: 3500, neutral: 3000, warn: 6500, deny: 9000 };

const EASE = [0.22, 1, 0.36, 1] as const;

function denyLine(r: CheckInResult, today: string): string {
  switch (r.reason) {
    case "expired":
      return expiredLabel(r.daysSinceExpiry ?? 0);
    case "frozen":
      return `Paused until ${formatDate(r.frozenUntil!, today)}`;
    case "not-started":
      return `Starts ${formatDate(r.startsOn!, today)}`;
    case "unknown-code":
      return "Card not linked";
    case "archived":
      return "Account archived";
    default:
      return "No active membership";
  }
}

export function ResultOverlay({
  r,
  sold,
  onDismiss,
  onSell,
  onLinkCard,
  onNewWithCode,
}: {
  r: CheckInResult;
  sold: string | null;
  onDismiss: () => void;
  onSell: (t: SellTarget) => void;
  onLinkCard: (code: string) => void;
  onNewWithCode: (code: string) => void;
}) {
  const reduce = useReducedMotion();
  const tone = resultTone(r, !!sold);
  const today = localDate(new Date(r.at));
  const first = r.member ? r.member.nickname || r.member.name.split(" ")[0] : null;
  const sellTarget: SellTarget | null = r.member ? { id: r.member.id, name: r.member.name, coverEnds: r.coverEnds ?? null } : null;
  const green = tone === "ok" || tone === "warn";

  const label = sold ? "Renewed" : tone === "neutral" ? "Already in" : green ? "Active" : "Denied";

  return (
    <motion.div
      role="alertdialog"
      aria-modal="true"
      aria-live="assertive"
      aria-label={`${label}${first ? `, ${first}` : ""}`}
      data-tone={tone}
      className="fixed inset-0 z-[70] flex cursor-pointer flex-col overflow-hidden select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      transition={{ duration: 0.16 }}
      onClick={onDismiss}
    >
      {/* colour field */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0",
          green && "bg-[#03170a]",
          tone === "deny" && "bg-[#1c0309]",
          tone === "neutral" && "bg-[#0b0b0b]",
        )}
      />
      <motion.div
        aria-hidden
        className={cn(
          "absolute -inset-[20%]",
          green && "bg-[radial-gradient(50%_45%_at_50%_38%,rgb(52_199_89/0.55),transparent_70%)]",
          tone === "deny" && "bg-[radial-gradient(50%_45%_at_50%_38%,rgb(225_29_72/0.6),transparent_70%)]",
          tone === "neutral" && "bg-[radial-gradient(50%_45%_at_50%_38%,rgb(255_255_255/0.14),transparent_70%)]",
        )}
        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: EASE }}
      />
      <motion.div
        className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-8 text-center"
        initial={reduce ? false : tone === "deny" ? { x: 0 } : { y: 24 }}
        animate={tone === "deny" && !reduce ? { x: [0, -16, 14, -9, 5, 0] } : { y: 0 }}
        transition={tone === "deny" ? { duration: 0.45, delay: 0.1 } : { duration: 0.5, ease: EASE }}
      >
        <StatusMark tone={tone} reduce={!!reduce} />

        <div className="flex flex-col items-center">
          <motion.p
            className={cn(
              "text-[13px] font-bold tracking-[0.32em] uppercase md:text-base",
              green && "text-[#7ff0a0]",
              tone === "deny" && "text-[#ff8da1]",
              tone === "neutral" && "text-white/60",
            )}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.35, ease: EASE }}
          >
            {label}
          </motion.p>

          <motion.h2
            className="text-statement mt-2 max-w-[14ch] text-[clamp(64px,17vw,148px)] leading-[0.86] break-words text-white"
            initial={reduce ? false : { opacity: 0, y: 18, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.22, duration: 0.5, ease: EASE }}
          >
            {first ?? "Unknown"}
          </motion.h2>

          {r.member ? (
            <motion.p
              className="tabular mt-3 flex items-center gap-2 text-sm text-white/55 md:text-base"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.36 }}
            >
              {r.member.photoUrl ? <MemberAvatar name={r.member.name} photoUrl={r.member.photoUrl} className="size-7 text-[11px]" /> : null}
              {r.member.name} · #{r.member.memberNo}
            </motion.p>
          ) : r.code ? (
            <p className="mt-3 font-mono text-lg tracking-[0.2em] text-white/60">{r.code}</p>
          ) : null}
        </div>

        {green || tone === "neutral" ? (
          <DaysBlock r={r} tone={tone} today={today} reduce={!!reduce} sold={sold} />
        ) : (
          <motion.p
            className="text-statement text-[clamp(28px,6vw,52px)] text-[#ffd1d9]"
            initial={reduce ? false : { opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.32, duration: 0.4, ease: EASE }}
          >
            {denyLine(r, today)}
          </motion.p>
        )}

        {tone === "warn" ? (
          <motion.div
            className="flex flex-wrap items-center justify-center gap-3"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4, ease: EASE }}
          >
            <span className="inline-flex h-12 items-center gap-2 rounded-full bg-energy px-5 text-sm font-bold tracking-wide text-black uppercase">
              <BellRing className="size-4 animate-[desk-ring_1.2s_ease-in-out_infinite]" strokeWidth={2.5} aria-hidden />
              Remind to renew
            </span>
            {sellTarget ? (
              <DeskButton onClick={() => onSell(sellTarget)} icon={RotateCcw}>
                Renew now
              </DeskButton>
            ) : null}
          </motion.div>
        ) : null}

        {tone === "deny" ? (
          <motion.div
            className="flex flex-wrap items-center justify-center gap-3"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4, ease: EASE }}
          >
            {sellTarget && r.reason !== "archived" && r.reason !== "frozen" ? (
              <DeskButton primary onClick={() => onSell(sellTarget)} icon={RotateCcw}>
                {r.reason === "expired" ? "Renew" : "Sell plan"}
              </DeskButton>
            ) : null}
            {!r.member && r.code ? (
              <>
                <DeskButton primary onClick={() => onLinkCard(r.code!)} icon={CreditCard}>
                  Link to member
                </DeskButton>
                <DeskButton onClick={() => onNewWithCode(r.code!)} icon={UserRoundPlus}>
                  New member
                </DeskButton>
              </>
            ) : null}
            {r.member ? (
              <DeskButton href={`/admin/members/${r.member.id}`} icon={UserRound}>
                Profile
              </DeskButton>
            ) : null}
          </motion.div>
        ) : null}
      </motion.div>

      <div className="relative z-10 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <p className="mb-3 text-center text-xs font-medium tracking-wide text-white/40">Tap anywhere to close</p>
        <div className="mx-auto h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className={cn("h-full origin-left", green ? "bg-success" : tone === "deny" ? "bg-red" : "bg-white/60")}
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: RESULT_MS[tone] / 1000, ease: "linear" }}
          />
        </div>
      </div>
    </motion.div>
  );
}

function DaysBlock({ r, tone, today, reduce, sold }: { r: CheckInResult; tone: DeskTone; today: string; reduce: boolean; sold: string | null }) {
  const days = r.daysLeft ?? 0;
  const big = days === 0 ? "Today" : String(days);
  const unit = days === 0 ? (tone === "warn" ? "last day" : "valid today") : days === 1 ? "day left" : "days left";
  return (
    <motion.div
      className="flex flex-col items-center"
      initial={reduce ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
    >
      <div className="flex items-baseline gap-3">
        <span className={cn("font-display tabular text-[clamp(72px,18vw,180px)] leading-none", tone === "warn" ? "text-energy" : "text-white")}>{big}</span>
        <span className={cn("text-left text-sm font-bold tracking-[0.18em] uppercase md:text-lg", tone === "warn" ? "text-energy" : "text-white/70")}>{unit}</span>
      </div>
      <p className="mt-2 text-sm text-white/55 md:text-base">
        {sold ?? [r.plan, r.coverEnds ? `until ${formatDate(r.coverEnds, today)}` : null].filter(Boolean).join(" · ")}
        {r.pt ? ` · ${r.pt.sessionsLeft} PT left` : ""}
      </p>
    </motion.div>
  );
}

function StatusMark({ tone, reduce }: { tone: DeskTone; reduce: boolean }) {
  const green = tone === "ok" || tone === "warn";
  const draw = (delay: number) =>
    reduce ? { initial: false as const } : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { delay, duration: 0.38, ease: EASE } };
  return (
    <motion.div
      className="relative grid size-28 place-items-center md:size-36"
      initial={reduce ? false : { scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
    >
      {!reduce ? (
        <motion.span
          aria-hidden
          className={cn("absolute inset-0 rounded-full", green ? "bg-success/40" : tone === "deny" ? "bg-red/45" : "bg-white/20")}
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 1.9, opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.05 }}
        />
      ) : null}
      <span
        className={cn(
          "absolute inset-0 rounded-full",
          green && "bg-success shadow-[0_0_80px_rgb(52_199_89/0.6)]",
          tone === "deny" && "bg-red shadow-[0_0_80px_rgb(225_29_72/0.65)]",
          tone === "neutral" && "bg-white/90",
        )}
      />
      <svg viewBox="0 0 48 48" className="relative size-16 md:size-20" fill="none" aria-hidden>
        {tone === "deny" ? (
          <>
            <motion.path d="M15 15 L33 33" stroke="#fff" strokeWidth={5.5} strokeLinecap="round" {...draw(0.15)} />
            <motion.path d="M33 15 L15 33" stroke="#fff" strokeWidth={5.5} strokeLinecap="round" {...draw(0.3)} />
          </>
        ) : (
          <motion.path
            d="M12 25 L20.5 33 L36 16"
            stroke={tone === "neutral" ? "#000" : "#02150a"}
            strokeWidth={5.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...draw(0.15)}
          />
        )}
      </svg>
    </motion.div>
  );
}

function DeskButton({
  children,
  icon: Icon,
  onClick,
  href,
  primary,
}: {
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  onClick?: () => void;
  href?: string;
  primary?: boolean;
}) {
  const cls = cn(
    "tap inline-flex h-14 min-w-36 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition-colors",
    primary ? "bg-white text-black hover:bg-white/90" : "bg-white/10 text-white ring-1 ring-white/20 ring-inset hover:bg-white/15",
  );
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  if (href)
    return (
      <Link href={href} className={cls} onClick={stop}>
        <Icon className="size-5" aria-hidden />
        {children}
      </Link>
    );
  return (
    <button
      type="button"
      className={cls}
      onClick={(e) => {
        stop(e);
        onClick?.();
      }}
    >
      <Icon className="size-5" aria-hidden />
      {children}
    </button>
  );
}
