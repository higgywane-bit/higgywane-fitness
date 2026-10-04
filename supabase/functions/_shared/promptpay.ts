/*
 * Thai QR payments: PromptPay and bill-payment QR codes, reading them back, and bank slips.
 * Spec: Bank of Thailand "Thai QR Code Standard" on EMVCo merchant-presented QR.
 *
 * No imports on purpose: supabase/functions/_shared/promptpay.ts is an exact copy that runs
 * in Deno, so the app, the tests and the server build and check QR codes the same way.
 */

/* ── EMVCo TLV + checksum ─────────────────────────────────── */

export type Tlv = Record<string, string>;

export function tlv(id: string, value: string): string {
  if (value.length > 99) throw new Error(`QR field ${id} is too long`);
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

/** Splits "000201010212…" into { "00": "01", "01": "12", … }. Null when malformed. */
export function parseTlv(input: string): Tlv | null {
  const out: Tlv = {};
  let i = 0;
  while (i < input.length) {
    if (i + 4 > input.length) return null;
    const id = input.slice(i, i + 2);
    const len = Number(input.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(input.slice(i + 2, i + 4)) || i + 4 + len > input.length) return null;
    out[id] = input.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}

/** CRC-16/CCITT-FALSE, as required by EMVCo tag 63 (and tag 91 on bank slips). */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** The checksum is the last 4 characters and covers everything before them, tag and length included. */
function checksumOk(payload: string, tag: string): boolean {
  const p = payload.trim();
  if (p.length < 8 || p.slice(-8, -4) !== `${tag}04`) return false;
  return crc16(p.slice(0, -4)) === p.slice(-4).toUpperCase();
}

/* ── PromptPay IDs ────────────────────────────────────────── */

const AID_TRANSFER = "A000000677010111";
const AID_BILL = "A000000677010112";

/** phone: 08x… · national-id: 13-digit ID card or company tax ID · ewallet: 15-digit wallet ID */
export type PromptPayIdKind = "phone" | "national-id" | "ewallet";
export type PromptPayId = { kind: PromptPayIdKind; /** digits as people write them, phone as 0812345678 */ id: string };

const TARGET_TAG: Record<PromptPayIdKind, string> = { phone: "01", "national-id": "02", ewallet: "03" };

/** Accepts 081-234-5678, +66 81 234 5678, 1-2345-67890-12-3 or a 15-digit wallet ID. */
export function readPromptPayId(input: string | null | undefined): PromptPayId | null {
  const d = (input ?? "").replace(/[\s\-+().]/g, "");
  if (!/^\d+$/.test(d)) return null;
  if (/^0[689]\d{8}$/.test(d)) return { kind: "phone", id: d };
  if (/^66[689]\d{8}$/.test(d)) return { kind: "phone", id: `0${d.slice(2)}` };
  if (/^0066[689]\d{8}$/.test(d)) return { kind: "phone", id: `0${d.slice(4)}` };
  if (d.length === 13) return { kind: "national-id", id: d };
  if (d.length === 15) return { kind: "ewallet", id: d };
  return null;
}

export function isPromptPayId(input: string | null | undefined): boolean {
  return readPromptPayId(input) !== null;
}

/** "081-234-5678", "1-2345-67890-12-3": what to print under the QR. */
export function formatPromptPayId(input: string): string {
  const t = readPromptPayId(input);
  if (!t) return input;
  if (t.kind === "phone") return `${t.id.slice(0, 3)}-${t.id.slice(3, 6)}-${t.id.slice(6)}`;
  if (t.kind === "national-id") return `${t.id[0]}-${t.id.slice(1, 5)}-${t.id.slice(5, 10)}-${t.id.slice(10, 12)}-${t.id[12]}`;
  return t.id;
}

/** Phones go on the wire as 0066 + 9 digits; IDs as written. */
function wireTarget(t: PromptPayId): string {
  return t.kind === "phone" ? `0066${t.id.slice(1)}` : t.id;
}

/* ── Amounts ──────────────────────────────────────────────── */

/** Satang-exact amount as the QR writes it ("418.00"). Throws on anything a bank app would reject. */
export function qrAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be more than ฿0");
  const satang = Math.round(amount * 100);
  if (Math.abs(satang - amount * 100) > 1e-6) throw new Error("Amount can't have more than 2 decimals");
  if (satang > 99_999_999_99) throw new Error("Amount is too large for a QR payment");
  return (satang / 100).toFixed(2);
}

function header(amount: number | undefined) {
  // 11 = static (customer types the amount, reusable), 12 = dynamic (fixed amount, one payment)
  return tlv("00", "01") + tlv("01", amount === undefined ? "11" : "12");
}

function footer(amount: number | undefined, extra = "") {
  const body = tlv("53", "764") + (amount === undefined ? "" : tlv("54", qrAmount(amount))) + tlv("58", "TH") + extra + "6304";
  return body;
}

/* ── Building QR codes ────────────────────────────────────── */

/**
 * PromptPay transfer to the gym's phone / tax ID / wallet. With an amount the customer can't change it.
 * Banks don't pass a reference through on these, so match payments by amount and time, or by slip.
 */
export function promptPayPayload(promptPayId: string, amount?: number): string {
  const t = readPromptPayId(promptPayId);
  if (!t) throw new Error("Not a PromptPay number: use a Thai mobile number, a 13-digit tax ID or a 15-digit e-wallet ID");
  const body = header(amount) + tlv("29", tlv("00", AID_TRANSFER) + tlv(TARGET_TAG[t.kind], wireTarget(t))) + footer(amount);
  return body + crc16(body);
}

export type BillPayment = {
  /** 15 digits from the bank: the company's 13-digit tax ID + a 2-digit suffix */
  billerId: string;
  /** shows on the bank statement and in the bank's notification, e.g. the order number */
  ref1: string;
  ref2?: string;
  amount?: number;
  /** up to 25 characters, Latin only */
  merchantName?: string;
};

const REF_RE = /^[0-9A-Z]{1,20}$/;

/** Bill reference from free text: "SF-1042" → "SF1042". Bank apps only take 0–9 and A–Z. */
export function billRef(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 20);
}

/**
 * Thai QR bill payment (tag 30). Needs a biller ID from the gym's business bank account, but every
 * payment then carries the order number, so the bank's webhook or statement says exactly what was paid.
 */
export function billPaymentPayload(bill: BillPayment): string {
  const biller = bill.billerId.replace(/\D/g, "");
  if (!/^\d{15}$/.test(biller)) throw new Error("Biller ID must be 15 digits (tax ID + 2-digit suffix from the bank)");
  if (!REF_RE.test(bill.ref1)) throw new Error("Reference 1 must be 1–20 letters A–Z or digits");
  if (bill.ref2 !== undefined && !REF_RE.test(bill.ref2)) throw new Error("Reference 2 must be 1–20 letters A–Z or digits");
  const merchant = tlv("00", AID_BILL) + tlv("01", biller) + tlv("02", bill.ref1) + (bill.ref2 ? tlv("03", bill.ref2) : "");
  const name = bill.merchantName ? tlv("59", bill.merchantName.replace(/[^\x20-\x7e]/g, "").trim().slice(0, 25)) : "";
  const body = header(bill.amount) + tlv("30", merchant) + footer(bill.amount, name);
  return body + crc16(body);
}

/* ── Reading QR codes back ────────────────────────────────── */

export type ThaiQr =
  | { kind: "promptpay"; target: PromptPayId; amount: number | null; reusable: boolean }
  | { kind: "bill"; billerId: string; ref1: string; ref2: string | null; amount: number | null; reusable: boolean; merchantName: string | null };

export type ThaiQrRead = { ok: true; qr: ThaiQr } | { ok: false; error: "checksum" | "format" | "not-thai-qr" | "currency" };

/** Reads any Thai QR payment code. Use it to double-check the gym's own QR before printing it. */
export function readThaiQr(payload: string): ThaiQrRead {
  const p = payload.trim();
  if (!checksumOk(p, "63")) return { ok: false, error: "checksum" };
  const top = parseTlv(p);
  if (!top || top["00"] !== "01") return { ok: false, error: "format" };
  if (top["58"] !== "TH" || top["53"] !== "764") return { ok: false, error: "currency" };
  const amount = top["54"] !== undefined ? Number(top["54"]) : null;
  if (amount !== null && !(amount > 0)) return { ok: false, error: "format" };
  const reusable = top["01"] !== "12";

  if (top["29"]) {
    const m = parseTlv(top["29"]);
    if (!m || m["00"] !== AID_TRANSFER) return { ok: false, error: "not-thai-qr" };
    let target: PromptPayId | null = null;
    if (/^0066\d{9}$/.test(m["01"] ?? "")) target = { kind: "phone", id: `0${m["01"].slice(4)}` };
    else if (/^\d{13}$/.test(m["02"] ?? "")) target = { kind: "national-id", id: m["02"] };
    else if (/^\d{15}$/.test(m["03"] ?? "")) target = { kind: "ewallet", id: m["03"] };
    if (!target) return { ok: false, error: "format" };
    return { ok: true, qr: { kind: "promptpay", target, amount, reusable } };
  }
  if (top["30"]) {
    const m = parseTlv(top["30"]);
    if (!m || m["00"] !== AID_BILL || !m["01"] || !m["02"]) return { ok: false, error: "not-thai-qr" };
    return { ok: true, qr: { kind: "bill", billerId: m["01"], ref1: m["02"], ref2: m["03"] ?? null, amount, reusable, merchantName: top["59"] ?? null } };
  }
  return { ok: false, error: "not-thai-qr" };
}

/* ── Bank slips ───────────────────────────────────────────────
 * Every Thai bank app puts a small "slip verification" QR on the transfer slip. It holds the
 * sending bank and the bank's transaction reference, nothing else: amount, time and receiver
 * come from the bank's slip-verification API (or a service like it) using that reference.
 * The reference is unique, so a slip can only ever pay for one thing.
 */

export const THAI_BANKS: Record<string, string> = {
  "002": "Bangkok Bank",
  "004": "Kasikorn Bank",
  "006": "Krungthai Bank",
  "011": "TMBThanachart (ttb)",
  "014": "SCB",
  "022": "CIMB Thai",
  "024": "UOB",
  "025": "Krungsri",
  "030": "GSB",
  "033": "GH Bank",
  "034": "BAAC",
  "066": "Islamic Bank",
  "067": "Tisco",
  "069": "Kiatnakin Phatra",
  "070": "ICBC Thai",
  "071": "Thai Credit",
  "073": "LH Bank",
};

export type SlipQr = { bankCode: string; bank: string | null; transRef: string };

export type SlipQrRead = { ok: true; slip: SlipQr } | { ok: false; error: "checksum" | "format" | "payment-qr" };

export function readSlipQr(raw: string): SlipQrRead {
  const p = raw.trim();
  if (checksumOk(p, "63")) return { ok: false, error: "payment-qr" }; // they scanned the shop's QR, not their slip
  if (!checksumOk(p, "91")) return { ok: false, error: "checksum" };
  const top = parseTlv(p);
  const api = top?.["00"] ? parseTlv(top["00"]) : null;
  if (!top || !api || top["51"] !== "TH" || !/^\d{3}$/.test(api["01"] ?? "") || !/^[0-9A-Za-z]{6,40}$/.test(api["02"] ?? "")) {
    return { ok: false, error: "format" };
  }
  return { ok: true, slip: { bankCode: api["01"], bank: THAI_BANKS[api["01"]] ?? null, transRef: api["02"] } };
}

/** What a slip-verification API tells us about a transfer. */
export type VerifiedSlip = {
  transRef: string;
  amount: number;
  paidAt: string;
  /** as the bank shows it, usually masked: "xxx-xxx-5678", "xxx-x-x1234-x" */
  receiverAccount: string;
  receiverName?: string | null;
  senderName?: string | null;
};

export type SlipExpectation = {
  amount: number;
  /** the gym's PromptPay ID and bank account numbers; a masked receiver must fit one of them */
  receivers: string[];
  /** when the payment was asked for; slips from before then don't count */
  notBefore: string;
  /** how old a slip may be, default 24 hours */
  maxAgeMinutes?: number;
  /** transaction refs already used to pay for something */
  usedRefs: Iterable<string>;
};

export type SlipProblem = "amount" | "receiver" | "too-early" | "too-old" | "already-used";

/**
 * Masked account vs a real one, compared from the right: "xxx-xxx-5678" fits "0812345678".
 * Phones are also tried in their 0066 / 66 forms because banks print either.
 */
export function receiverMatches(masked: string, actual: string): boolean {
  const m = masked.toLowerCase().replace(/[^0-9x]/g, "");
  if (!/\d/.test(m)) return false;
  const digits = actual.replace(/\D/g, "");
  const forms = new Set([digits]);
  const t = readPromptPayId(actual);
  if (t?.kind === "phone") ["66" + t.id.slice(1), "0066" + t.id.slice(1)].forEach((f) => forms.add(f));
  return [...forms].some((a) => {
    if (a.length < m.length) return false;
    const tail = a.slice(-m.length);
    return [...m].every((ch, i) => ch === "x" || ch === tail[i]);
  });
}

/** Pure checks for a verified slip. Grace of 2 minutes on `notBefore` for phone clocks. */
export function checkSlip(slip: VerifiedSlip, expect: SlipExpectation, now: Date = new Date()): { ok: boolean; problems: SlipProblem[] } {
  const problems: SlipProblem[] = [];
  if (Math.round(slip.amount * 100) !== Math.round(expect.amount * 100)) problems.push("amount");
  if (!expect.receivers.some((r) => receiverMatches(slip.receiverAccount, r))) problems.push("receiver");
  const paid = new Date(slip.paidAt).getTime();
  if (paid < new Date(expect.notBefore).getTime() - 2 * 60_000) problems.push("too-early");
  if (now.getTime() - paid > (expect.maxAgeMinutes ?? 24 * 60) * 60_000) problems.push("too-old");
  if ([...expect.usedRefs].includes(slip.transRef)) problems.push("already-used");
  return { ok: problems.length === 0, problems };
}

export const SLIP_PROBLEM_TEXT: Record<SlipProblem, string> = {
  amount: "The amount on the slip doesn't match.",
  receiver: "This slip wasn't paid to Superfit.",
  "too-early": "This slip is from before the order.",
  "too-old": "This slip is too old.",
  "already-used": "This slip has already been used.",
};
