import { headerKey, parseLooseDate } from "@/lib/csv";

/*
 * Reads any uploaded report (Glofox exports first) without knowing its format in advance:
 * profiles every column (date, money, number, category…), guesses what kind of report it is,
 * then builds the figures. Every guess can be overridden from the report page.
 */

export type ReportKind = "transactions" | "attendance" | "members" | "memberships" | "generic";
export type ColumnType = "date" | "time" | "money" | "number" | "id" | "category" | "text" | "empty";

export const KIND_LABEL: Record<ReportKind, string> = {
  transactions: "Sales / transactions",
  attendance: "Attendance / bookings",
  members: "Members / clients",
  memberships: "Memberships",
  generic: "Other report",
};

export type ColumnProfile = {
  index: number;
  header: string;
  type: ColumnType;
  filled: number;
  distinct: number;
  sample: string[];
};

const NUM = /^\(?-?\s*[฿$€£]?\s*-?\d[\d,]*(\.\d+)?\)?\s*(thb|baht)?$/i;
const TIME = /^\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?$/i;
const has = (h: string, re: RegExp) => re.test(headerKey(h));

export function parseNumber(raw: string): number | null {
  const s = raw.trim();
  if (!s || !NUM.test(s)) return null;
  const neg = /^\(.*\)$/.test(s) || s.includes("-");
  const n = Number(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

export function profileColumns(headers: string[], rows: string[][], dayFirst = true): ColumnProfile[] {
  const sampleRows = rows.length > 3000 ? rows.filter((_, i) => i % Math.ceil(rows.length / 3000) === 0) : rows;
  return headers.map((header, index) => {
    const values = sampleRows.map((r) => (r[index] ?? "").trim()).filter(Boolean);
    const distinctSet = new Set(values);
    const filled = rows.reduce((a, r) => a + ((r[index] ?? "").trim() ? 1 : 0), 0);
    const share = (test: (v: string) => boolean) => (values.length ? values.filter(test).length / values.length : 0);
    let type: ColumnType;
    if (!values.length) type = "empty";
    else if (has(header, /(^|[^a-z])(id|uuid)$|barcode|^code$|phone|mobile|reference|^ref|number$|^no$/) || has(header, /^(memberid|clientid|userid|transactionid)$/)) type = "id";
    else if (has(header, /email|address|note|comment/)) type = "text";
    // names and descriptions are free text, unless they repeat (a product sold many times, a regular client)
    else if (has(header, /name$|description|item|product/) && !(distinctSet.size <= 80 && distinctSet.size < values.length * 0.7)) type = "text";
    else if (share((v) => TIME.test(v)) >= 0.8) type = "time";
    else if (share((v) => !!parseLooseDate(v, dayFirst)) >= 0.8) type = "date";
    else if (share((v) => parseNumber(v) !== null) >= 0.8)
      type = has(header, /amount|total|price|revenue|paid|value|net|gross|sales|cost|fee|charge|thb|baht|subtotal/) || share((v) => /[฿$.]/.test(v)) > 0.5 ? "money" : "number";
    else if (distinctSet.size <= Math.max(12, values.length * 0.3) && distinctSet.size <= 80) type = "category";
    else type = "text";
    return { index, header, type, filled, distinct: distinctSet.size, sample: [...distinctSet].slice(0, 4) };
  });
}

export function detectKind(headers: string[], cols: ColumnProfile[]): ReportKind {
  const all = headers.map(headerKey).join(" ");
  const money = cols.some((c) => c.type === "money");
  if (money && /transaction|payment|invoice|receipt|sale|amount|total|revenue|paid/.test(all)) return "transactions";
  if (/attend|booking|booked|checkin|class|session|visit|program|event/.test(all)) return "attendance";
  if (/membership|plan/.test(all) && /start|expir|enddate|end|renew/.test(all) && !/email/.test(all)) return "memberships";
  if (/email|phone|firstname|client|member/.test(all)) return "members";
  if (money) return "transactions";
  return "generic";
}

export type AnalysisOptions = {
  kind?: ReportKind;
  dateCol?: number | null;
  /** numeric column to add up; null = count rows */
  valueCol?: number | null;
  groupCol?: number | null;
  dayFirst?: boolean;
};

type Pick = (c: ColumnProfile) => boolean;
function choose(cols: ColumnProfile[], ok: Pick, prefer: RegExp[]): number | null {
  const pool = cols.filter(ok);
  for (const re of prefer) {
    const hit = pool.find((c) => re.test(headerKey(c.header)));
    if (hit) return hit.index;
  }
  return pool[0]?.index ?? null;
}

export type Kpi = { label: string; value: number | string; format: "count" | "thb" | "decimal" | "text" | "pct" };
export type GroupRow = { label: string; value: number; count: number };

export type Analysis = {
  kind: ReportKind;
  columns: ColumnProfile[];
  dateCol: number | null;
  valueCol: number | null;
  groupCol: number | null;
  valueIsMoney: boolean;
  rows: number;
  range: { from: string; to: string } | null;
  kpis: Kpi[];
  monthly: { date: string; value: number; count: number }[];
  weekday: number[];
  hours: number[] | null;
  groups: GroupRow[];
  breakdowns: { header: string; items: GroupRow[] }[];
};

function topGroups(rows: string[][], col: number, value: (r: string[]) => number, limit: number): GroupRow[] {
  const m = new Map<string, GroupRow>();
  for (const r of rows) {
    const label = (r[col] ?? "").trim() || "(blank)";
    const g = m.get(label) ?? { label, value: 0, count: 0 };
    g.value += value(r);
    g.count++;
    m.set(label, g);
  }
  return [...m.values()].sort((a, b) => b.value - a.value || b.count - a.count).slice(0, limit);
}

function addMonth(ym: string, n: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function analyze(headers: string[], rows: string[][], opts: AnalysisOptions = {}): Analysis {
  const dayFirst = opts.dayFirst ?? true;
  const cols = profileColumns(headers, rows, dayFirst);
  const kind = opts.kind ?? detectKind(headers, cols);

  const datePrefs: Record<ReportKind, RegExp[]> = {
    transactions: [/paid|transaction|payment|purchase|sale/, /date/, /created/],
    attendance: [/attend|checkin|class|booking|start/, /date/],
    members: [/join|signup|since|created|registered/, /date/],
    memberships: [/start/, /purchase|created/, /date/],
    generic: [/date/, /created/],
  };
  const groupPrefs: Record<ReportKind, RegExp[]> = {
    transactions: [/item|product|description|membership|plan|service|category|type/, /payment|method/],
    attendance: [/class|program|session|event|service/, /coach|trainer|instructor|staff/],
    members: [/membership|plan/, /status/, /type|source|gender/],
    memberships: [/membership|plan|name/, /status/],
    generic: [/type|category|status|name/],
  };

  const dateCol = opts.dateCol !== undefined ? opts.dateCol : choose(cols, (c) => c.type === "date", datePrefs[kind]);
  const valueCol =
    opts.valueCol !== undefined
      ? opts.valueCol
      : kind === "transactions"
        ? choose(cols, (c) => c.type === "money", [/net|total|amount|paid|revenue/])
        : null;
  const groupCol = opts.groupCol !== undefined ? opts.groupCol : choose(cols, (c) => c.type === "category" && c.distinct > 1, groupPrefs[kind]);
  const valueIsMoney = valueCol !== null && cols[valueCol]?.type === "money";

  const val = (r: string[]) => (valueCol === null ? 1 : (parseNumber(r[valueCol] ?? "") ?? 0));
  const dates = dateCol === null ? [] : rows.map((r) => parseLooseDate(r[dateCol] ?? "", dayFirst));
  const timeCol = cols.find((c) => c.type === "time")?.index ?? null;

  // monthly series, gaps filled, last 36 months at most
  const byMonth = new Map<string, { value: number; count: number }>();
  const weekday = Array(7).fill(0) as number[];
  const hours = Array(24).fill(0) as number[];
  let hasHours = false;
  let from: string | null = null;
  let to: string | null = null;
  rows.forEach((r, i) => {
    const d = dates[i];
    if (!d) return;
    if (!from || d < from) from = d;
    if (!to || d > to) to = d;
    const ym = d.slice(0, 7);
    const b = byMonth.get(ym) ?? { value: 0, count: 0 };
    b.value += val(r);
    b.count++;
    byMonth.set(ym, b);
    weekday[(new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7] += val(r);
    const timeText = timeCol !== null ? r[timeCol] : dateCol !== null ? r[dateCol] : "";
    const t = (timeText ?? "").match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (t) {
      let h = Number(t[1]);
      if (t[3]) h = (h % 12) + (t[3].toLowerCase() === "pm" ? 12 : 0);
      if (h < 24) {
        hours[h] += val(r);
        if (h !== 0 || t[2] !== "00") hasHours = true;
      }
    }
  });
  const monthly: Analysis["monthly"] = [];
  if (from && to) {
    let ym = addMonth((to as string).slice(0, 7), -35) > (from as string).slice(0, 7) ? addMonth((to as string).slice(0, 7), -35) : (from as string).slice(0, 7);
    const end = (to as string).slice(0, 7);
    while (ym <= end) {
      const b = byMonth.get(ym) ?? { value: 0, count: 0 };
      monthly.push({ date: `${ym}-01`, ...b });
      ym = addMonth(ym, 1);
    }
  }

  const groups = groupCol === null ? [] : topGroups(rows, groupCol, val, 12);
  const breakdowns = cols
    .filter((c) => c.type === "category" && c.index !== groupCol && c.distinct > 1 && c.distinct <= 30)
    .slice(0, 4)
    .map((c) => ({ header: c.header, items: topGroups(rows, c.index, val, 6) }));

  // headline numbers
  const total = rows.reduce((a, r) => a + val(r), 0);
  const kpis: Kpi[] = [];
  const bestMonth = [...monthly].sort((a, b) => b.value - a.value)[0];
  const personCol = choose(cols, (c) => c.type !== "empty" && c.type !== "date" && c.type !== "money", [/memberid|clientid|userid|email/, /^name$|fullname|clientname|membername/]);
  const people = personCol === null ? null : new Set(rows.map((r) => (r[personCol] ?? "").trim().toLowerCase()).filter(Boolean)).size;
  const label = (n: number) => (valueIsMoney ? "thb" : "count") as Kpi["format"];

  if (kind === "transactions") {
    kpis.push({ label: valueIsMoney ? "Revenue" : "Total", value: total, format: label(total) });
    kpis.push({ label: "Transactions", value: rows.length, format: "count" });
    kpis.push({ label: "Average", value: rows.length ? total / rows.length : 0, format: valueIsMoney ? "thb" : "decimal" });
  } else if (kind === "attendance") {
    kpis.push({ label: "Visits", value: rows.length, format: "count" });
    if (people) kpis.push({ label: "Unique members", value: people, format: "count" });
    if (people) kpis.push({ label: "Visits per member", value: rows.length / people, format: "decimal" });
  } else if (kind === "members" || kind === "memberships") {
    kpis.push({ label: kind === "members" ? "Members" : "Memberships", value: rows.length, format: "count" });
    const email = cols.find((c) => /email/.test(headerKey(c.header)));
    if (email) kpis.push({ label: "Have an email", value: rows.length ? Math.round((email.filled / rows.length) * 100) : 0, format: "pct" });
    if (groups[0]) kpis.push({ label: `Top ${cols[groupCol!].header.toLowerCase()}`, value: groups[0].label, format: "text" });
  } else {
    kpis.push({ label: "Rows", value: rows.length, format: "count" });
    if (valueCol !== null) kpis.push({ label: `Total ${headers[valueCol]}`, value: total, format: label(total) });
  }
  if (bestMonth && monthly.length > 1) {
    kpis.push({ label: "Best month", value: new Date(`${bestMonth.date}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }), format: "text" });
  }

  return {
    kind,
    columns: cols,
    dateCol,
    valueCol,
    groupCol,
    valueIsMoney,
    rows: rows.length,
    range: from && to ? { from, to } : null,
    kpis,
    monthly,
    weekday,
    hours: hasHours ? hours : null,
    groups,
    breakdowns,
  };
}

/** Several uploads of the same report (e.g. one export per quarter) read as one; overlapping rows count once. */
export function combineRows(uploads: { headers: string[]; rows: string[][] }[]): { headers: string[]; rows: string[][] } {
  if (!uploads.length) return { headers: [], rows: [] };
  const headers = uploads[0].headers;
  const sig = headers.map(headerKey).join("|");
  // A row repeated inside one file is real (two identical sales); one repeated across files is overlap.
  const seen = new Set<string>();
  const rows: string[][] = [];
  for (const u of uploads) {
    if (u.headers.map(headerKey).join("|") !== sig) continue;
    const mine: string[] = [];
    for (const r of u.rows) {
      const k = JSON.stringify(r);
      if (seen.has(k)) continue;
      mine.push(k);
      rows.push(r);
    }
    mine.forEach((k) => seen.add(k));
  }
  return { headers, rows };
}
