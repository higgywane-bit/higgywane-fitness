import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { members, memberships, reminders } from "@/lib/db/schema";
import { reminderEmail } from "@/lib/email/templates";
import type { Mailer } from "@/lib/email";
import { localDate } from "./dates";
import { dueReminders, type DueReminder } from "./reminders";
import { logActivity } from "./service";

/** Reminders that are due and haven't been sent yet. */
export async function pendingReminders(db: DB, now = new Date()): Promise<DueReminder[]> {
  const [ms, rows] = await Promise.all([db.select().from(memberships), db.select().from(members)]);
  const byMember = new Map<string, typeof ms>();
  for (const m of ms) byMember.set(m.memberId, [...(byMember.get(m.memberId) ?? []), m]);
  const due = dueReminders(
    rows.map((m) => ({
      memberId: m.id,
      email: m.email,
      firstName: m.nickname || m.firstName,
      marketingOptIn: m.marketingOptIn,
      archived: !!m.archivedAt,
      memberships: byMember.get(m.id) ?? [],
    })),
    localDate(now),
  );
  if (!due.length) return [];
  const sent = await db.select().from(reminders).where(inArray(reminders.memberId, due.map((d) => d.memberId)));
  const key = (x: { memberId: string; endsOn: string; kind: string }) => `${x.memberId}|${x.endsOn}|${x.kind}`;
  const done = new Set(sent.map(key));
  return due.filter((d) => !done.has(key(d)));
}

export async function sendReminders(db: DB, mailer: Mailer, now = new Date()) {
  const due = await pendingReminders(db, now);
  let sent = 0;
  const failed: string[] = [];
  for (const r of due) {
    try {
      // claim first so two overlapping runs can't double-send
      const claimed = await db
        .insert(reminders)
        .values({ memberId: r.memberId, endsOn: r.endsOn, kind: r.kind, channel: mailer.live ? "email" : "preview", sentAt: now })
        .onConflictDoNothing()
        .returning({ id: reminders.id });
      if (!claimed.length) continue;
      try {
        await mailer.send({ to: r.email, ...reminderEmail(r) });
      } catch (err) {
        await db.delete(reminders).where(and(eq(reminders.id, claimed[0].id)));
        throw err;
      }
      await logActivity(db, r.memberId, "reminder.sent", `${mailer.live ? "Emailed" : "Preview"}: ${reminderEmail(r).subject}`, now);
      sent++;
    } catch (err) {
      console.error(err);
      failed.push(r.email);
    }
  }
  return { due: due.length, sent, failed };
}
