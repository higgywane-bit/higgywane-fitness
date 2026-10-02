import { eq } from "drizzle-orm";
import type { MemberListRow } from "@/lib/admin/queries";
import type { DB } from "@/lib/db/client";
import { members, messages } from "@/lib/db/schema";
import type { Mailer } from "@/lib/email";
import { logActivity, ServiceError } from "@/lib/membership/service";
import { currentActor } from "@/lib/staff/context";
import { inSegment, normalizeTags, personalise, segmentLabel, type SegmentId } from "./segments";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function recipientsFor(rows: MemberListRow[], seg: SegmentId) {
  return rows.filter((m) => inSegment(m, seg) && m.email && m.marketingOptIn);
}

/** Email a segment. Without a live mail provider this records a preview and sends nothing. */
export async function sendMessage(db: DB, mailer: Mailer, rows: MemberListRow[], input: { audience: SegmentId; subject: string; body: string }) {
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject || !body) throw new ServiceError("Add a subject and a message.");
  const to = recipientsFor(rows, input.audience);
  if (!to.length) throw new ServiceError("Nobody in that group has an email address and allows messages.");
  let sent = 0;
  for (const m of to) {
    const text = personalise(body, m);
    try {
      await mailer.send({
        to: m.email!,
        subject: personalise(subject, m),
        text,
        html: `<div style="font-family:-apple-system,Inter,Arial,sans-serif;font-size:16px;line-height:1.55;color:#111;max-width:520px">${text
          .split(/\n{2,}/)
          .map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`)
          .join("")}</div>`,
      });
      sent++;
      await logActivity(db, m.id, "message.sent", `${mailer.live ? "Emailed" : "Preview"}: ${personalise(subject, m)}`);
    } catch (err) {
      console.error(err);
    }
  }
  const [row] = await db
    .insert(messages)
    .values({
      channel: "email",
      audience: input.audience,
      audienceLabel: segmentLabel(input.audience),
      subject,
      body,
      recipients: to.length,
      sent,
      status: mailer.live ? "sent" : "preview",
      staffId: currentActor(),
    })
    .returning();
  return row;
}

export async function setMemberTags(db: DB, memberId: string, tags: string[] | string) {
  const clean = normalizeTags(tags);
  await db.update(members).set({ tags: clean, updatedAt: new Date() }).where(eq(members.id, memberId));
  await logActivity(db, memberId, "member.tags", clean.length ? `Tags: ${clean.join(", ")}` : "Tags cleared");
}

export async function addMemberNote(db: DB, memberId: string, note: string) {
  const text = note.trim();
  if (!text) throw new ServiceError("Write a note first.");
  await logActivity(db, memberId, "note", text.slice(0, 1000));
}
