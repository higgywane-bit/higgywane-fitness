import type { MemberListRow } from "@/lib/admin/queries";

/*
 * Who a message goes to. Segments are computed from the same member standing the rest
 * of the admin uses, so "expiring" here means exactly what it means on the dashboard.
 */

export type SegmentId = "active" | "expiring" | "lapsed-30" | "lapsed-90" | "at-risk" | "no-plan" | "everyone" | `tag:${string}`;

export const SEGMENTS: { id: SegmentId; label: string; description: string }[] = [
  { id: "active", label: "Active members", description: "Everyone who can train today" },
  { id: "expiring", label: "Expiring soon", description: "Plan ends in 7 days or fewer" },
  { id: "at-risk", label: "At risk", description: "Active but no visit in 14+ days" },
  { id: "lapsed-30", label: "Lapsed (30 days)", description: "Expired in the last 30 days" },
  { id: "lapsed-90", label: "Lapsed (90 days)", description: "Expired in the last 90 days" },
  { id: "no-plan", label: "Never bought a plan", description: "In the system, no membership yet" },
  { id: "everyone", label: "Everyone", description: "All members who allow messages" },
];

export function inSegment(m: MemberListRow, seg: SegmentId): boolean {
  if (m.archived) return false;
  if (seg.startsWith("tag:")) return m.tags.includes(seg.slice(4));
  switch (seg) {
    case "active":
      return m.status === "active" || m.status === "expiring";
    case "expiring":
      return m.status === "expiring";
    case "at-risk":
      return m.atRisk;
    case "lapsed-30":
      return m.status === "expired" && (m.daysSinceExpiry ?? 999) <= 30;
    case "lapsed-90":
      return m.status === "expired" && (m.daysSinceExpiry ?? 999) <= 90;
    case "no-plan":
      return m.status === "none";
    default:
      return true;
  }
}

export function segmentLabel(seg: SegmentId): string {
  return seg.startsWith("tag:") ? `Tagged “${seg.slice(4)}”` : (SEGMENTS.find((s) => s.id === seg)?.label ?? seg);
}

/** {firstName}, {plan}, {daysLeft} placeholders. */
export function personalise(text: string, m: Pick<MemberListRow, "name" | "nickname" | "plan" | "daysLeft">): string {
  const first = m.nickname || m.name.split(" ")[0];
  return text
    .replace(/\{firstName\}/g, first)
    .replace(/\{plan\}/g, m.plan ?? "membership")
    .replace(/\{daysLeft\}/g, m.daysLeft != null ? String(m.daysLeft) : "");
}

export function normalizeTags(raw: string[] | string): string[] {
  const list = Array.isArray(raw) ? raw : raw.split(",");
  return [...new Set(list.map((t) => t.trim().toLowerCase().replace(/\s+/g, "-")).filter((t) => t && t.length <= 24))].slice(0, 12);
}
