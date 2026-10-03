import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { FileUp } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { RemoveDemoButton, SendRemindersButton } from "@/components/admin/settings-actions";
import { Button } from "@/components/ui/button";
import { GYM } from "@/content/gym";
import { PLANS } from "@/content/plans";
import { getDb, t } from "@/lib/db";
import { getMailer } from "@/lib/email";
import { formatTHB } from "@/lib/format";
import { pendingReminders } from "@/lib/membership/reminder-service";

export const metadata = { title: "Settings" };

function Status({ on, label, detail }: { on: boolean; label: string; detail: React.ReactNode }) {
  return (
    <li className="flex gap-3 py-3">
      <span aria-hidden className={on ? "mt-1.5 size-2 shrink-0 rounded-full bg-success" : "mt-1.5 size-2 shrink-0 rounded-full bg-white/30"} />
      <div className="min-w-0">
        <p className="font-semibold">{label}</p>
        <p className="text-sm text-text-secondary">{detail}</p>
      </div>
    </li>
  );
}

const Code = ({ children }: { children: React.ReactNode }) => <code className="rounded bg-surface-3 px-1.5 py-0.5 text-xs">{children}</code>;

export default async function SettingsPage() {
  const db = await getDb();
  const [[{ n: demo }], due] = await Promise.all([
    db.select({ n: count() }).from(t.members).where(eq(t.members.source, "demo")),
    pendingReminders(db),
  ]);
  const mailer = getMailer();
  const hosted = !!process.env.DATABASE_URL;

  return (
    <div className="pb-12">
      <PageHeader eyebrow="Superfit admin" title="Settings" />
      <div className="grid gap-3 px-4 md:gap-4 md:px-8 xl:grid-cols-2">
        <Panel title="Connections">
          <ul className="divide-y divide-hairline">
            <Status
              on={hosted}
              label={hosted ? "Database: hosted Postgres" : "Database: on this computer"}
              detail={
                hosted ? (
                  "Members are stored in the cloud database (DATABASE_URL)."
                ) : (
                  <>
                    Running on a local Postgres in <Code>.data/</Code>. Set <Code>DATABASE_URL</Code> (Supabase or Neon, Singapore region) before going live.
                  </>
                )
              }
            />
            <Status
              on={!!process.env.ADMIN_EMAIL && !!process.env.ADMIN_PASSWORD}
              label={process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD ? `Admin sign-in: ${process.env.ADMIN_EMAIL}` : "Admin sign-in: off"}
              detail={
                process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD ? (
                  "Sign in once per device with the Superfit email. Staff then pick who's working with their PIN."
                ) : (
                  <>
                    Anyone with the link can open admin. Set <Code>ADMIN_EMAIL</Code> and <Code>ADMIN_PASSWORD</Code> before real member data goes online.
                  </>
                )
              }
            />
            <Status
              on={!!process.env.QASHIER_WEBHOOK_SECRET}
              label="Qashier"
              detail={
                <>
                  CSV import on <Link href="/admin/sales" className="underline underline-offset-4">Sales</Link>. Live feed via <Code>/api/qashier/webhook</Code> once Qashier enables API access.
                </>
              }
            />
            <Status
              on={mailer.live}
              label={`Email: ${mailer.name}`}
              detail={
                mailer.live ? (
                  "Renewal reminders send every morning at 09:00."
                ) : (
                  <>
                    Reminders are worked out but not sent. Add <Code>RESEND_API_KEY</Code> and <Code>EMAIL_FROM</Code> to switch them on.
                  </>
                )
              }
            />
            <Status on={false} label="Glofox" detail="No API needed: export the client list and import it. Re-import on switch-over day to catch late renewals." />
          </ul>
          <Button asChild variant="outline" className="mt-3">
            <Link href="/admin/import">
              <FileUp className="size-4" aria-hidden />
              Import from Glofox
            </Link>
          </Button>
        </Panel>

        <Panel title={`Renewal reminders · ${due.length} due today`}>
          <p className="text-sm text-text-secondary">
            Members with an email get a reminder {GYM.reminders.before.map((d) => (d === 1 ? "1 day" : `${d} days`)).join(" and ")} before their plan ends, and a “we miss you” email{" "}
            {GYM.reminders.after.join(", ")} days after. Each sends once per plan, every morning at 09:00.
          </p>
          {due.length ? (
            <ul className="mt-4 divide-y divide-hairline text-sm">
              {due.slice(0, 8).map((r) => (
                <li key={`${r.memberId}${r.kind}`} className="flex justify-between gap-3 py-2.5">
                  <Link href={`/admin/members/${r.memberId}`} className="truncate font-medium hover:underline">
                    {r.firstName} · {r.email}
                  </Link>
                  <span className="shrink-0 text-text-secondary">
                    {r.kind.startsWith("before") ? (r.daysLeft === 0 ? "ends today" : `${r.daysLeft}d left`) : `lapsed ${r.daysSinceExpiry}d`}
                  </span>
                </li>
              ))}
              {due.length > 8 ? <li className="py-2.5 text-text-tertiary">and {due.length - 8} more</li> : null}
            </ul>
          ) : null}
          <div className="mt-4">
            <SendRemindersButton count={due.length} live={mailer.live} />
          </div>
        </Panel>

        <Panel title="Front desk rules">
          <dl className="divide-y divide-hairline text-sm">
            {[
              ["Expiring soon", `${GYM.expiringSoonDays} days or fewer left`],
              ["Renewal nudge at check-in", `${GYM.renewNudgeDays} days or fewer left, and on the last day`],
              ["Double scans", `Ignored within ${GYM.duplicateScanSeconds / 60} minutes`],
              ["Opening hours (charts)", `${GYM.hours.open}:00 – ${GYM.hours.close}:00`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5">
                <dt className="text-text-secondary">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mt-5 mb-2 text-[13px] font-medium text-text-secondary">Plans (prices from pricing.json)</h3>
          <ul className="grid grid-cols-2 gap-x-6 text-sm">
            {PLANS.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 py-1.5">
                <span className="text-text-secondary">{p.name}</span>
                <span className="tabular">{formatTHB(p.price)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-text-tertiary">
            Change these in <Code>content/gym.ts</Code> and <Code>content/pricing.json</Code>.
          </p>
        </Panel>

        <Panel title="Hardware">
          <ul className="space-y-3 text-sm text-text-secondary">
            <li>
              <span className="font-semibold text-white">USB / Bluetooth scanner.</span> Plug it in, open Check-in, scan. It types the code and presses Enter like a keyboard; nothing to install. Use a <span className="text-white">2D imager</span> scanner: it reads phone screens and QR codes. Older 1D laser scanners only read the barcodes on Glofox cards.
            </li>
            <li>
              <span className="font-semibold text-white">iPad at the desk.</span> Open Check-in, tap the camera icon, and members hold up their phone. Add it to the Home Screen for a full-screen app.
            </li>
            <li>
              <span className="font-semibold text-white">No scanner?</span> Type the 8-character code from the member&apos;s phone, or search their name.
            </li>
          </ul>
        </Panel>

        <Panel title="Exports (CSV)">
          <p className="mb-4 text-sm text-text-secondary">For your accountant, backups, or moving data. Opens in Excel, Numbers and Google Sheets.</p>
          <ul className="grid grid-cols-2 gap-2">
            {[
              ["members", "Members"],
              ["check-ins", "Check-ins · 90 days"],
              ["sales", "Sales · 12 months"],
              ["expenses", "Expenses · 12 months"],
              ["leads", "Leads"],
              ["timesheets", "Timesheets · 2 months"],
              ["pt-sessions", "PT sessions"],
            ].map(([k, label]) => (
              <li key={k}>
                <a href={`/admin/export/${k}`} download className="tap glass flex h-11 items-center justify-center rounded-full px-4 text-sm font-medium hover:bg-white/[0.07]">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Team access">
          <p className="text-sm text-text-secondary">
            Until real logins are connected, each device picks <span className="text-white">who&apos;s working</span> (bottom of the menu). Staff with a PIN must enter it. Everything they do is labelled with their name in the Activity log. Demo data: the Owner&apos;s PIN is 1234.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/admin/staff">Manage staff</Link>
          </Button>
        </Panel>

        <Panel title="Demo data">
          <p className="mb-4 text-sm text-text-secondary">
            {demo ? `${demo} made-up members, visits and sales are loaded so every screen has something to show. Remove them before the real import.` : "Only real data is loaded."}
          </p>
          <RemoveDemoButton count={demo} />
        </Panel>
      </div>
    </div>
  );
}
