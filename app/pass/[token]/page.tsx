import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { getPass } from "@/lib/admin/queries";
import { daysLeftLabel, expiredLabel } from "@/lib/membership/access";
import { formatAccessCode } from "@/lib/membership/codes";
import { formatDate } from "@/lib/membership/dates";
import { qrSvg } from "@/lib/qr";
import { cn } from "@/lib/utils";

/*
 * The member's pass, until the member app with logins exists: a private link
 * (/pass/<secret>) they save to their home screen and show at the desk.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My pass",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  appleWebApp: { capable: true, title: "Superfit Pass", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#000000" };

export default async function PassPage({ params }: { params: Promise<{ token: string }> }) {
  const pass = await getPass((await params).token);
  if (!pass) notFound();
  const { standing: s, today } = pass;
  const svg = pass.code ? await qrSvg(pass.code) : null;
  const ok = s.status === "active" || s.status === "expiring";

  const line =
    s.status === "active" || s.status === "expiring"
      ? `${s.current!.planName} · ${daysLeftLabel(s.daysLeft ?? 0)}`
      : s.status === "frozen"
        ? `Paused until ${formatDate(s.frozenUntil!, today)}`
        : s.status === "upcoming"
          ? `${s.current!.planName} starts ${formatDate(s.startsOn!, today)}`
          : s.status === "expired"
            ? `${expiredLabel(s.daysSinceExpiry ?? 0)} · renew at the front desk`
            : "No membership yet · see the front desk";

  return (
    <main className="pt-safe pb-safe flex min-h-dvh flex-col items-center bg-black px-5">
      <div className="flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-7 py-10">
        <Logo className="h-6" />
        <div className="w-full rounded-[32px] border border-hairline-strong bg-surface-1 p-6 text-center shadow-[0_40px_120px_-30px_rgb(225_29_72/0.35)]">
          <p className="text-xs font-semibold tracking-[0.18em] text-text-tertiary uppercase">Member #{pass.memberNo}</p>
          <h1 className="text-statement mt-1 text-[44px] break-words">{pass.name}</h1>
          {svg ? (
            <div className="mx-auto mt-6 w-full max-w-[280px] rounded-[28px] bg-white p-6">
              <div className="aspect-square [&_svg]:size-full" role="img" aria-label="Your check-in QR code" dangerouslySetInnerHTML={{ __html: svg }} />
            </div>
          ) : null}
          {pass.code ? <p className="tabular mt-5 font-mono text-[26px] tracking-[0.2em]">{formatAccessCode(pass.code)}</p> : null}
          <div
            className={cn(
              "mt-5 inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold",
              ok ? (s.status === "expiring" ? "bg-energy/15 text-energy" : "bg-success/15 text-success") : "bg-red/15 text-red-text",
            )}
          >
            <span aria-hidden className={cn("size-1.5 rounded-full", ok ? (s.status === "expiring" ? "bg-energy" : "bg-success") : "bg-red")} />
            {line}
          </div>
          {ok && s.coverEnds ? <p className="mt-2 text-sm text-text-secondary">Valid until {formatDate(s.coverEnds, today)}</p> : null}
          {s.pt ? <p className="mt-1 text-sm text-text-secondary">{s.pt.sessionsLeft} PT sessions left</p> : null}
        </div>
        <p className="max-w-xs text-center text-sm text-text-tertiary">
          Show this at the front desk. Tip: tap Share → <span className="text-text-secondary">Add to Home Screen</span> to keep it one tap away, and turn your brightness up.
        </p>
      </div>
    </main>
  );
}
