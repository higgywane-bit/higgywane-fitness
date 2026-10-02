/*
 * Dashboard modules. Every module the dashboard can show is listed here once:
 * what it's called, what it shows, how wide it can be. The layout (which are on,
 * in what order, how wide) is just a list of ids saved in the database, so adding
 * a module later is: add it here + a loader/renderer in components/admin/dashboard/.
 */

export type WidgetGroup = "members" | "visits" | "sales" | "business" | "team";
/** columns on a wide screen (4-column grid); phones show 1 = half width, 2/4 = full */
export type WidgetSize = 1 | 2 | 4;

export type WidgetMeta = {
  id: string;
  title: string;
  description: string;
  group: WidgetGroup;
  sizes: readonly WidgetSize[];
  /** where the numbers come from, shown in the editor */
  source: "Superfit" | "Qashier" | "Superfit + Qashier" | "Website";
};

export const WIDGETS = [
  // headline numbers
  { id: "kpi-active", title: "Active members", description: "Members who can train today, and new sign-ups this month", group: "members", sizes: [1], source: "Superfit" },
  { id: "kpi-in-today", title: "In today", description: "Members checked in today vs the same time last week", group: "visits", sizes: [1], source: "Superfit" },
  { id: "kpi-expiring", title: "Expiring soon", description: "Memberships ending in the next 7 days", group: "members", sizes: [1], source: "Superfit" },
  { id: "kpi-new-members", title: "New members", description: "Members created this month vs last month", group: "members", sizes: [1], source: "Superfit" },
  { id: "kpi-memberships-sold", title: "Memberships sold", description: "Plans sold at the desk this month, count and value", group: "members", sizes: [1], source: "Superfit" },
  { id: "kpi-visits-per-member", title: "Visits per member", description: "Average visits per active member, last 30 days", group: "visits", sizes: [1], source: "Superfit" },
  { id: "kpi-sales-today", title: "Sales today", description: "Till total today vs the same day last week", group: "sales", sizes: [1], source: "Qashier" },
  { id: "kpi-sales-week", title: "Sales this week", description: "Last 7 days vs the 7 days before", group: "sales", sizes: [1], source: "Qashier" },
  { id: "kpi-sales-month", title: "Sales this month", description: "Month to date vs the same days last month", group: "sales", sizes: [1], source: "Qashier" },
  { id: "kpi-avg-sale", title: "Average sale", description: "Average receipt this month", group: "sales", sizes: [1], source: "Qashier" },
  // charts
  { id: "visits-daily", title: "Visits · last 30 days", description: "Check-ins per day", group: "visits", sizes: [2, 4], source: "Superfit" },
  { id: "busy-hours", title: "Busiest hours", description: "When members train, last 8 weeks", group: "visits", sizes: [2, 4], source: "Superfit" },
  { id: "active-trend", title: "Active members · 12 weeks", description: "How many members had a live membership each week", group: "members", sizes: [2, 4], source: "Superfit" },
  { id: "sales-daily", title: "Sales · last 30 days", description: "Till total per day", group: "sales", sizes: [2, 4], source: "Qashier" },
  { id: "sales-monthly", title: "Sales by month", description: "Last 12 months", group: "sales", sizes: [2, 4], source: "Qashier" },
  { id: "sales-by-type", title: "Sales by type", description: "Cafe, memberships, PT, retail this month", group: "sales", sizes: [2], source: "Qashier" },
  { id: "top-sellers", title: "Top sellers", description: "Best-selling items this month, by revenue", group: "sales", sizes: [2, 4], source: "Qashier" },
  { id: "members-by-plan", title: "Members by plan", description: "Active members on each plan", group: "members", sizes: [2], source: "Superfit" },
  // lists
  { id: "expiring-list", title: "Expiring soon", description: "Who to ask about renewing", group: "members", sizes: [2], source: "Superfit" },
  { id: "win-back", title: "Win back", description: "Expired in the last 30 days", group: "members", sizes: [2], source: "Superfit" },
  { id: "latest-checkins", title: "Latest check-ins", description: "Live feed from the front desk", group: "visits", sizes: [2], source: "Superfit" },
  { id: "top-visitors", title: "Most consistent", description: "Members with the most visits, last 30 days", group: "visits", sizes: [2], source: "Superfit" },
  { id: "birthdays", title: "Birthdays", description: "Members with a birthday in the next 7 days", group: "members", sizes: [2], source: "Superfit" },
  { id: "recent-sales", title: "Recent sales", description: "Latest receipts from the till", group: "sales", sizes: [2, 4], source: "Qashier" },
  // business
  { id: "kpi-profit-month", title: "Profit this month", description: "Sales minus costs, month to date", group: "business", sizes: [1], source: "Superfit + Qashier" },
  { id: "kpi-costs-month", title: "Costs this month", description: "Expenses including monthly fixed costs", group: "business", sizes: [1], source: "Superfit" },
  { id: "targets", title: "Monthly targets", description: "Progress towards this month's goals", group: "business", sizes: [2, 4], source: "Superfit + Qashier" },
  { id: "profit-monthly", title: "Profit by month", description: "Last 12 months, sales minus costs", group: "business", sizes: [2, 4], source: "Superfit + Qashier" },
  { id: "kpi-renewal-rate", title: "Renewal rate", description: "Plans that ended in the last 90 days and were renewed", group: "members", sizes: [1], source: "Superfit" },
  { id: "kpi-churn", title: "Churn this month", description: "Members active on the 1st who no longer are", group: "members", sizes: [1], source: "Superfit" },
  { id: "at-risk", title: "At risk", description: "Active members with no visit in 14+ days", group: "members", sizes: [2], source: "Superfit" },
  { id: "kpi-open-leads", title: "Open leads", description: "Enquiries not yet joined or lost, with follow-ups due", group: "members", sizes: [1], source: "Superfit" },
  { id: "follow-ups", title: "Follow-ups due", description: "Leads to call today or overdue", group: "members", sizes: [2], source: "Superfit" },
  { id: "kpi-cafe-orders", title: "Cafe orders today", description: "Website orders today and waiting at the bar", group: "sales", sizes: [1], source: "Website" },
  { id: "kpi-pt-month", title: "PT sessions", description: "Sessions delivered this month, requests waiting", group: "team", sizes: [1], source: "Superfit" },
  { id: "on-shift", title: "Working today", description: "Who's on the rota and who's clocked in", group: "team", sizes: [2], source: "Superfit" },
] as const satisfies readonly WidgetMeta[];

export type WidgetId = (typeof WIDGETS)[number]["id"];

export const GROUP_LABEL: Record<WidgetGroup, string> = { members: "Members", visits: "Visits", sales: "Sales & cafe", business: "Business", team: "Team & coaching" };

export type LayoutItem = { id: WidgetId; size: WidgetSize };
export type DashboardLayout = { version: 1; items: LayoutItem[] };

const META = new Map<string, WidgetMeta>(WIDGETS.map((w) => [w.id, w]));

export function widgetMeta(id: string): WidgetMeta | undefined {
  return META.get(id);
}

const L = (...items: (WidgetId | [WidgetId, WidgetSize])[]): DashboardLayout => ({
  version: 1,
  items: items.map((i) => (Array.isArray(i) ? { id: i[0], size: i[1] } : { id: i, size: META.get(i)!.sizes[0] })),
});

export const PRESETS = {
  owner: {
    label: "Owner",
    description: "The whole business at a glance",
    layout: L(
      "kpi-active",
      "kpi-in-today",
      "kpi-sales-month",
      "kpi-profit-month",
      "targets",
      "visits-daily",
      "busy-hours",
      "profit-monthly",
      "top-sellers",
      "expiring-list",
      "at-risk",
      "kpi-renewal-rate",
      "kpi-churn",
      "kpi-open-leads",
      "kpi-pt-month",
      "win-back",
      "members-by-plan",
    ),
  },
  desk: {
    label: "Front desk",
    description: "Today, renewals to chase, who's in",
    layout: L("kpi-in-today", "kpi-expiring", "kpi-cafe-orders", "kpi-open-leads", "expiring-list", "latest-checkins", "follow-ups", "on-shift", "at-risk", "birthdays"),
  },
  sales: {
    label: "Sales & cafe",
    description: "Till numbers and what's selling",
    layout: L("kpi-sales-today", "kpi-sales-week", "kpi-sales-month", "kpi-avg-sale", ["sales-daily", 4], "kpi-cafe-orders", "kpi-profit-month", "kpi-costs-month", "kpi-memberships-sold", "top-sellers", "sales-by-type", ["sales-monthly", 4], ["profit-monthly", 4], "recent-sales"),
  },
  growth: {
    label: "Growth",
    description: "Members, retention and habits",
    layout: L("kpi-active", "kpi-new-members", "kpi-renewal-rate", "kpi-churn", ["active-trend", 4], "kpi-open-leads", "kpi-memberships-sold", "kpi-visits-per-member", "kpi-pt-month", "at-risk", "follow-ups", "members-by-plan", "top-visitors", "win-back", "expiring-list"),
  },
} satisfies Record<string, { label: string; description: string; layout: DashboardLayout }>;

export type PresetId = keyof typeof PRESETS;

export const DEFAULT_LAYOUT = PRESETS.owner.layout;

/** Clean up whatever is stored: unknown ids dropped, duplicates removed, sizes kept to what each module allows. */
export function normalizeLayout(raw: unknown): DashboardLayout {
  const items = (raw as { items?: unknown })?.items;
  if (!Array.isArray(items)) return DEFAULT_LAYOUT;
  const seen = new Set<string>();
  const out: LayoutItem[] = [];
  for (const it of items) {
    const id = typeof it === "string" ? it : (it as { id?: unknown })?.id;
    if (typeof id !== "string" || seen.has(id)) continue;
    const meta = META.get(id);
    if (!meta) continue;
    seen.add(id);
    const size = Number((it as { size?: unknown })?.size);
    out.push({ id: id as WidgetId, size: (meta.sizes as readonly number[]).includes(size) ? (size as WidgetSize) : meta.sizes[0] });
  }
  return { version: 1, items: out };
}
