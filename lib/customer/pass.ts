import { daysLeftLabel, memberStanding, type MemberStatus, type MembershipLike } from "@/lib/membership/access";
import { diffDays, formatDate, type ISODate } from "@/lib/membership/dates";

/*
 * The customer app: the digital pass and "my membership", worked out from the same rules
 * the front desk uses, so the app and the check-in screen never disagree.
 */

export type CredentialLike = { kind: string; code: string; createdAt: string | Date; revokedAt?: string | Date | null };

export type PassCode = {
  /** exactly what the desk scanner should type: the QR and barcode hold this */
  code: string;
  /** "123 456" for reading out at the desk */
  display: string;
  kind: "card" | "qr";
};

/**
 * Which code the phone pass shows. The member's tag code first, so the app pass and the
 * keyring tag are interchangeable at the desk; otherwise the code made for them in admin.
 */
export function pickPassCode(credentials: CredentialLike[]): PassCode | null {
  const live = credentials
    .filter((c) => !c.revokedAt && c.code.trim())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const pick = live.find((c) => c.kind === "card") ?? live.find((c) => c.kind === "qr");
  if (!pick) return null;
  return { code: pick.code, display: formatPassCode(pick.code), kind: pick.kind === "card" ? "card" : "qr" };
}

export function formatPassCode(code: string): string {
  const c = code.replace(/\s+/g, "");
  if (/^\d{6}$/.test(c)) return `${c.slice(0, 3)} ${c.slice(3)}`;
  return c.replace(/(.{4})(?=.)/g, "$1 ");
}

export type Tone = "ok" | "warn" | "deny" | "muted";

export type CustomerMembershipView = {
  status: MemberStatus;
  tone: Tone;
  /** pill text: ACTIVE, EXPIRING, PAUSED… */
  badge: string;
  canTrain: boolean;
  planName: string | null;
  /** big line: "30 days left", "Ends tomorrow", "Starts 12 Oct" */
  headline: string;
  /** one friendly sentence under it */
  message: string;
  startedOn: ISODate | null;
  coveredUntil: ISODate | null;
  daysLeft: number | null;
  /** share of the current plan already used, 0–1, for the progress ring */
  progress: number;
  pt: { planName: string; sessionsLeft: number; sessionsTotal: number | null; endsOn: ISODate } | null;
};

const BADGE: Record<MemberStatus, [string, Tone]> = {
  active: ["Active", "ok"],
  expiring: ["Expiring", "warn"],
  frozen: ["Paused", "muted"],
  upcoming: ["Starts soon", "muted"],
  expired: ["Expired", "deny"],
  none: ["No plan", "muted"],
};

export function customerMembershipView(ms: MembershipLike[], today: ISODate): CustomerMembershipView {
  const s = memberStanding(ms, today);
  const [badge, tone] = BADGE[s.status];
  const c = s.current;
  const pt = s.pt
    ? { planName: s.pt.membership.planName, sessionsLeft: s.pt.sessionsLeft, sessionsTotal: s.pt.membership.sessionsTotal ?? null, endsOn: s.pt.endsOn }
    : null;
  const base = { status: s.status, tone, badge, planName: c?.planName ?? null, startedOn: c?.startsOn ?? null, pt };
  const d = (iso: ISODate) => formatDate(iso, today);

  switch (s.status) {
    case "active":
    case "expiring": {
      const total = Math.max(1, diffDays(c!.startsOn, s.coverEnds!) + 1);
      return {
        ...base,
        canTrain: true,
        headline: daysLeftLabel(s.daysLeft!),
        message:
          s.status === "expiring"
            ? `Covered until midnight on ${d(s.coverEnds!)}. Renew at the desk to keep training.`
            : `Covered until midnight on ${d(s.coverEnds!)}.`,
        coveredUntil: s.coverEnds!,
        daysLeft: s.daysLeft!,
        progress: clamp((total - (s.daysLeft! + 1)) / total),
      };
    }
    case "frozen":
      return {
        ...base,
        canTrain: false,
        headline: `Paused until ${d(s.frozenUntil!)}`,
        message: `Your end date moved to ${d(s.coverEnds!)} to make up for the pause.`,
        coveredUntil: s.coverEnds!,
        daysLeft: s.daysLeft!,
        progress: 0,
      };
    case "upcoming":
      return { ...base, canTrain: false, headline: `Starts ${d(s.startsOn!)}`, message: "See you then.", coveredUntil: c!.endsOn, daysLeft: null, progress: 0 };
    case "expired":
      return {
        ...base,
        canTrain: false,
        headline: `Ended ${d(s.endedOn!)}`,
        message: "Renew at the front desk and you're straight back in.",
        coveredUntil: s.endedOn!,
        daysLeft: null,
        progress: 1,
      };
    default:
      return { ...base, canTrain: false, headline: "No membership yet", message: "Pick a plan at the front desk to start training.", coveredUntil: null, daysLeft: null, progress: 0 };
  }
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));
