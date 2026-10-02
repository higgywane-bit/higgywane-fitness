import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { secretMatches } from "@/lib/api-auth";
import { categorize, type SaleInput } from "@/lib/sales/qashier";
import { saveSales } from "@/lib/sales/service";

/*
 * Live sales from Qashier. Qashier's API is enabled per merchant on request; when it
 * is, point its transaction webhook here with header "x-superfit-secret".
 * The body shape below is ours: adapt `toSale` to Qashier's real payload then.
 * TODO: confirm with owner (Qashier API access + payload sample)
 */
export const dynamic = "force-dynamic";

type Incoming = {
  receiptNo?: string;
  id?: string;
  occurredAt?: string;
  createdAt?: string;
  total?: number | string;
  paymentMethod?: string;
  status?: string;
  items?: { name: string; qty?: number; amount?: number }[];
};

function toSale(x: Incoming): SaleInput | null {
  const id = x.receiptNo ?? x.id;
  const at = new Date(x.occurredAt ?? x.createdAt ?? "");
  const total = Number(x.total);
  if (!id || Number.isNaN(at.getTime()) || !Number.isFinite(total)) return null;
  if (x.status && /void|refund|cancel/i.test(x.status)) return null;
  const names = (x.items ?? []).map((i) => i.name).join(", ");
  return {
    externalId: String(id),
    occurredAt: at,
    amountSatang: Math.round(total * 100),
    category: categorize(names),
    description: names.slice(0, 200) || null,
    paymentMethod: x.paymentMethod ?? null,
    items: x.items?.length
      ? x.items.map((i) => ({ name: i.name, qty: Math.max(1, Math.round(i.qty ?? 1)), amountSatang: Math.round((i.amount ?? 0) * 100) }))
      : undefined,
  };
}

export async function POST(req: Request) {
  if (!secretMatches(req.headers.get("x-superfit-secret"), process.env.QASHIER_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { sales?: Incoming[] } | Incoming | null;
  if (!body) return NextResponse.json({ error: "invalid json" }, { status: 400 });
  const list = Array.isArray((body as { sales?: Incoming[] }).sales) ? (body as { sales: Incoming[] }).sales : [body as Incoming];
  const sales = list.map(toSale).filter((s): s is SaleInput => !!s);
  const result = await saveSales(await getDb(), sales.slice(0, 1000));
  return NextResponse.json({ received: list.length, ...result });
}
