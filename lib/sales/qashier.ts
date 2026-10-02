import { autoMap, parseCSV, parseLooseDate } from "@/lib/csv";

/*
 * Qashier → sales. Qashier's back office exports transaction reports as CSV, and
 * Qashier offers API access on request (qashier.com/api-integration) for pushing
 * transactions to us. Both land here as SaleInput, keyed by receipt number so the
 * same sale imported twice is stored once.
 * TODO: confirm with owner (Qashier API access + a sample export)
 */

export type SaleCategory = "membership" | "pt" | "cafe" | "retail" | "other";

export type SaleInput = {
  externalId: string;
  occurredAt: Date;
  amountSatang: number;
  category: SaleCategory;
  description: string | null;
  paymentMethod: string | null;
};

const FIELDS = {
  receipt: ["receiptno", "receiptnumber", "receipt", "transactionid", "transactionno", "orderid", "orderno", "invoiceno", "billno", "id"],
  date: ["datetime", "transactiondate", "date", "createdat", "time", "transactiontime"],
  time: ["time", "transactiontime"],
  amount: ["nettotal", "grandtotal", "totalamount", "total", "amount", "netsales", "sales"],
  item: ["itemname", "item", "product", "productname", "description", "items"],
  category: ["category", "itemcategory", "productcategory", "department"],
  payment: ["paymentmethod", "paymenttype", "payment", "tender", "tendertype"],
  status: ["status", "transactionstatus"],
};

/** Which bucket a sale belongs to, from its item name or POS category. */
export function categorize(...texts: (string | null | undefined)[]): SaleCategory {
  const s = texts.filter(Boolean).join(" ").toLowerCase();
  if (/\bpt\b|personal train|coach/.test(s)) return "pt";
  if (/member|day pass|week|month|annual|gym|pass/.test(s)) return "membership";
  if (/coffee|latte|smoothie|juice|shake|matcha|espresso|americano|cappuccino|mocha|cafe|café|food|drink|bowl|snack/.test(s)) return "cafe";
  if (/shirt|tee|merch|apparel|supplement|whey|creatine|bottle|shaker|retail/.test(s)) return "retail";
  return "other";
}

export function parseAmountSatang(raw: string): number | null {
  const s = raw.replace(/[^\d.,-]/g, "");
  if (!s) return null;
  // "1,200.50" or "1.200,50"
  const normalized = /,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function parseDateTime(dateRaw: string, timeRaw: string | undefined): Date | null {
  const day = parseLooseDate(dateRaw);
  if (!day) return null;
  const t = (timeRaw ?? dateRaw).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
  let h = t ? Number(t[1]) : 12;
  if (t?.[4]) h = (h % 12) + (t[4].toLowerCase() === "pm" ? 12 : 0);
  const hh = String(h).padStart(2, "0");
  const mm = t ? t[2] : "00";
  const ss = t?.[3] ?? "00";
  return new Date(`${day}T${hh}:${mm}:${ss}+07:00`);
}

export type SalesParse = { sales: SaleInput[]; skipped: { row: number; reason: string }[]; headers: string[] };

/**
 * One row per receipt, or one row per line item with a shared receipt number
 * (lines are summed into a single sale).
 */
export function parseQashierCSV(csv: string): SalesParse {
  const [headers = [], ...body] = parseCSV(csv);
  const map = autoMap(headers, FIELDS);
  const skipped: SalesParse["skipped"] = [];
  if (map.date === undefined || map.amount === undefined) {
    return { sales: [], skipped: [{ row: 1, reason: "Needs at least a date and a total column" }], headers };
  }
  const byReceipt = new Map<string, SaleInput & { items: string[] }>();
  body.forEach((cells, i) => {
    const get = (k: keyof typeof FIELDS) => (map[k] === undefined ? "" : (cells[map[k]!] ?? "").trim());
    const row = i + 2;
    if (/void|refund|cancel/i.test(get("status"))) return skipped.push({ row, reason: `Status ${get("status")}` });
    const occurredAt = parseDateTime(get("date"), map.time !== undefined && map.time !== map.date ? get("time") : undefined);
    const amount = parseAmountSatang(get("amount"));
    if (!occurredAt) return skipped.push({ row, reason: "Unreadable date" });
    if (amount === null) return skipped.push({ row, reason: "Unreadable amount" });
    const id = get("receipt") || `${occurredAt.toISOString()}-${amount}`;
    const prev = byReceipt.get(id);
    const item = get("item");
    if (prev) {
      prev.amountSatang += amount;
      if (item) prev.items.push(item);
      return;
    }
    byReceipt.set(id, {
      externalId: id,
      occurredAt,
      amountSatang: amount,
      category: "other",
      description: null,
      paymentMethod: get("payment") || null,
      items: item ? [item] : [],
      ...(get("category") ? { description: get("category") } : {}),
    });
  });
  const sales = [...byReceipt.values()].map(({ items, ...s }) => ({
    ...s,
    category: categorize(items.join(" "), s.description),
    description: items.length ? items.join(", ").slice(0, 200) : s.description,
  }));
  return { sales, skipped, headers };
}
