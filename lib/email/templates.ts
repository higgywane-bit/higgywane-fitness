import type { DueReminder } from "@/lib/membership/reminders";
import { formatDate } from "@/lib/membership/dates";
import type { Email } from "./index";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function wrap(lines: string[]) {
  return `<div style="font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;font-size:16px;line-height:1.55;color:#111;max-width:520px">${lines
    .map((l) => `<p style="margin:0 0 14px">${l}</p>`)
    .join("")}<p style="margin:24px 0 0;color:#777;font-size:13px">Superfit · Train with us</p></div>`;
}

/** Renewal reminder copy. TODO: confirm with owner (wording, Thai version, LINE link) */
export function reminderEmail(r: DueReminder): Omit<Email, "to"> {
  const name = esc(r.firstName);
  const end = formatDate(r.endsOn);
  if (r.kind.startsWith("before")) {
    const when = r.daysLeft === 0 ? "today" : r.daysLeft === 1 ? "tomorrow" : `on ${end}`;
    const subject = r.daysLeft !== undefined && r.daysLeft <= 1 ? `Your Superfit membership ends ${when}` : `${r.daysLeft} days left on your Superfit membership`;
    const lines = [
      `Hi ${name},`,
      `Your ${esc(r.plan)} membership ends ${when}. Renew at the front desk next time you train and your new plan starts the day after, so you don't lose a day.`,
      `Going longer saves more: 3 months saves ฿1,200 and 12 months saves ฿14,400 compared to paying monthly.`,
      `See you on the floor.`,
    ];
    return { subject, text: lines.join("\n\n").replace(/<[^>]+>/g, ""), html: wrap(lines) };
  }
  const lines = [
    `Hi ${name},`,
    `Your Superfit membership ended on ${end}. We miss seeing you in the gym.`,
    `Pop into the front desk any time to pick up where you left off: a day pass, a week, or a month to get the routine back.`,
  ];
  return { subject: "We miss you at Superfit", text: lines.join("\n\n"), html: wrap(lines) };
}
