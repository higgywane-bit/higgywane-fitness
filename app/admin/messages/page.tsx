import { desc, eq } from "drizzle-orm";
import { MessageComposer } from "@/components/admin/message-composer";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { getDb, t } from "@/lib/db";
import { getMailer } from "@/lib/email";
import { formatMoment } from "@/lib/membership/dates";
import { cn } from "@/lib/utils";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const db = await getDb();
  const [history, tagRows] = await Promise.all([
    db.select({ m: t.messages, staffName: t.staff.name }).from(t.messages).leftJoin(t.staff, eq(t.staff.id, t.messages.staffId)).orderBy(desc(t.messages.createdAt)).limit(30),
    db.select({ tags: t.members.tags }).from(t.members),
  ]);
  const tags = [...new Set(tagRows.flatMap((r) => r.tags))].sort();
  const mailer = getMailer();

  return (
    <div className="pb-12">
      <PageHeader eyebrow={mailer.live ? "Email connected" : "Email not connected: previews only"} title="Messages" />
      <div className="grid gap-3 px-4 md:gap-4 md:px-8 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title="New message">
          <MessageComposer tags={tags} live={mailer.live} />
        </Panel>
        <Panel title="Sent">
          {history.length ? (
            <ul className="divide-y divide-hairline">
              {history.map(({ m, staffName }) => (
                <li key={m.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">{m.subject}</p>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", m.status === "sent" ? "bg-success/15 text-success" : "bg-white/[0.06] text-text-secondary")}>
                      {m.status === "sent" ? "Sent" : "Preview"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    {m.audienceLabel} · {m.sent} of {m.recipients}
                    {staffName ? ` · by ${staffName}` : ""}
                  </p>
                  <p className="text-xs text-text-tertiary">{formatMoment(m.createdAt)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-tertiary">Nothing sent yet.</p>
          )}
          <p className="mt-4 text-xs text-text-tertiary">Renewal reminders send automatically every morning (Settings). LINE messages can use these same groups once a LINE Official Account is connected.</p>
        </Panel>
      </div>
    </div>
  );
}
