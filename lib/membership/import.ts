import { eq, inArray } from "drizzle-orm";
import { parseCSV } from "@/lib/csv";
import type { DB } from "@/lib/db/client";
import { activity, cafeOrders, checkIns, credentials, expenses, leads, members, memberships, messages, ptBookings, sales, staff } from "@/lib/db/schema";
import { generateAccessCode, generatePassToken } from "./codes";
import { localDate } from "./dates";
import { buildDraft, guessMapping, type ImportDraft, type ImportMapping } from "./glofox";
import { normalizeEmail, normalizePhone } from "./service";

export type ImportAction = "create" | "update" | "skip";

export type ImportPlanRow = {
  draft: ImportDraft;
  action: ImportAction;
  matchId?: string;
  matchName?: string;
  /** why a row is skipped or what an update does */
  note?: string;
  /** link the card on update/create */
  linkCard: boolean;
  /** add the membership on update/create */
  addMembership: boolean;
};

export type ImportPlan = {
  headers: string[];
  mapping: ImportMapping;
  rows: ImportPlanRow[];
  errors: { row: number; error: string }[];
  totals: { rows: number; create: number; update: number; skip: number; errors: number; activeMemberships: number; cards: number };
};

export function readImportFile(csv: string, mapping?: ImportMapping) {
  const [headers = [], ...body] = parseCSV(csv);
  return { headers, body, mapping: mapping ?? guessMapping(headers) };
}

/** Dry run: what would happen to every row. Nothing is written. */
export async function planImport(db: DB, csv: string, opts: { mapping?: ImportMapping; dayFirst?: boolean; now?: Date } = {}): Promise<ImportPlan> {
  const today = localDate(opts.now);
  const { headers, body, mapping } = readImportFile(csv, opts.mapping);

  const existing = await db
    .select({ id: members.id, firstName: members.firstName, lastName: members.lastName, email: members.email, phone: members.phone, source: members.source, externalId: members.externalId })
    .from(members);
  const creds = await db.select({ code: credentials.code, memberId: credentials.memberId }).from(credentials);
  const ends = await db.select({ memberId: memberships.memberId, endsOn: memberships.endsOn, kind: memberships.kind }).from(memberships);

  const byExt = new Map(existing.filter((m) => m.source === "glofox" && m.externalId).map((m) => [m.externalId!, m]));
  const byEmail = new Map(existing.filter((m) => m.email).map((m) => [m.email!.toLowerCase(), m]));
  const byPhone = new Map(existing.filter((m) => m.phone).map((m) => [m.phone!, m]));
  const byId = new Map(existing.map((m) => [m.id, m]));
  const cardOwner = new Map(creds.map((c) => [c.code, c.memberId]));
  const latestEnd = new Map<string, string>();
  for (const e of ends) {
    const key = `${e.memberId}:${e.kind}`;
    if (!latestEnd.has(key) || latestEnd.get(key)! < e.endsOn) latestEnd.set(key, e.endsOn);
  }

  const rows: ImportPlanRow[] = [];
  const errors: ImportPlan["errors"] = [];
  const seen = new Map<string, number>();

  body.forEach((cells, i) => {
    const result = buildDraft(cells, i + 2, mapping, today, opts.dayFirst ?? true);
    if (!result.ok) return errors.push({ row: result.row, error: result.error });
    const d = result.draft;
    const email = normalizeEmail(d.email);
    const phone = normalizePhone(d.phone);

    const keys = [d.externalId && `x:${d.externalId}`, email && `e:${email}`, phone && `p:${phone}`].filter(Boolean) as string[];
    const dupRow = keys.map((k) => seen.get(k)).find((r) => r !== undefined);
    keys.forEach((k) => seen.set(k, d.row));
    if (dupRow !== undefined) {
      rows.push({ draft: d, action: "skip", note: `Same person as row ${dupRow}`, linkCard: false, addMembership: false });
      return;
    }

    const match =
      (d.externalId && byExt.get(d.externalId)) ||
      (email && byEmail.get(email)) ||
      (phone && byPhone.get(phone)) ||
      (d.cardCode && cardOwner.has(d.cardCode) ? byId.get(cardOwner.get(d.cardCode)!) : undefined) ||
      undefined;

    const cardFree = !!d.cardCode && !cardOwner.has(d.cardCode);
    if (d.cardCode && !cardFree && (!match || cardOwner.get(d.cardCode) !== match.id)) {
      d.warnings.push(`Card ${d.cardCode} already belongs to another member`);
    }
    if (cardFree) cardOwner.set(d.cardCode!, match?.id ?? `row-${d.row}`);

    if (!match) {
      rows.push({ draft: d, action: "create", linkCard: cardFree, addMembership: !!d.membership });
      return;
    }
    const end = d.membership && latestEnd.get(`${match.id}:${d.membership.kind}`);
    const newer = !!d.membership && (!end || d.membership.endsOn > end);
    const matchName = `${match.firstName} ${match.lastName}`.trim();
    if (!newer && !cardFree) {
      rows.push({ draft: d, action: "skip", matchId: match.id, matchName, note: "Already up to date", linkCard: false, addMembership: false });
      return;
    }
    const what = [newer && `membership to ${d.membership!.endsOn}`, cardFree && `card ${d.cardCode}`].filter(Boolean).join(" + ");
    rows.push({ draft: d, action: "update", matchId: match.id, matchName, note: `Adds ${what}`, linkCard: cardFree, addMembership: newer });
  });

  const count = (a: ImportAction) => rows.filter((r) => r.action === a).length;
  return {
    headers,
    mapping,
    rows,
    errors,
    totals: {
      rows: body.length,
      create: count("create"),
      update: count("update"),
      skip: count("skip"),
      errors: errors.length,
      activeMemberships: rows.filter((r) => r.action !== "skip" && r.addMembership && r.draft.membership!.endsOn >= today).length,
      cards: rows.filter((r) => r.linkCard).length,
    },
  };
}

const CHUNK = 250;
async function chunked<T>(items: T[], fn: (part: T[]) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += CHUNK) await fn(items.slice(i, i + CHUNK));
}

/** Apply a plan in bulk (a few queries per 250 rows, so a full Glofox export runs in seconds). */
export async function runImport(db: DB, plan: ImportPlan, now = new Date()) {
  const creates = plan.rows.filter((r) => r.action === "create");
  const updates = plan.rows.filter((r) => r.action === "update");
  const usedCodes = new Set((await db.select({ code: credentials.code }).from(credentials)).map((c) => c.code));
  const newCode = () => {
    let c = generateAccessCode();
    while (usedCodes.has(c)) c = generateAccessCode();
    usedCodes.add(c);
    return c;
  };

  const created: { memberId: string; row: ImportPlanRow }[] = [];
  await chunked(creates, async (part) => {
    const inserted = await db
      .insert(members)
      .values(
        part.map(({ draft: d }) => ({
          firstName: d.firstName,
          lastName: d.lastName,
          email: normalizeEmail(d.email),
          phone: normalizePhone(d.phone),
          birthDate: d.birthDate,
          gender: d.gender,
          notes: d.notes,
          source: "glofox",
          externalId: d.externalId,
          passToken: generatePassToken(),
          createdAt: now,
          updatedAt: now,
        })),
      )
      .returning({ id: members.id });
    inserted.forEach((m, i) => created.push({ memberId: m.id, row: part[i] }));
  });

  const targets = [...created, ...updates.map((row) => ({ memberId: row.matchId!, row }))];
  const creds = [
    ...created.map(({ memberId }) => ({ memberId, kind: "qr", code: newCode(), createdAt: now })),
    ...targets.filter((t) => t.row.linkCard).map(({ memberId, row }) => ({ memberId, kind: "card", code: row.draft.cardCode!, createdAt: now })),
  ];
  await chunked(creds, (part) => db.insert(credentials).values(part));

  const ms = targets
    .filter((t) => t.row.addMembership && t.row.draft.membership)
    .map(({ memberId, row }) => {
      const m = row.draft.membership!;
      return {
        memberId,
        planId: m.planId,
        planName: m.planName,
        kind: m.kind,
        startsOn: m.startsOn,
        endsOn: m.endsOn,
        sessionsTotal: m.sessionsTotal,
        price: 0,
        paymentMethod: "glofox",
        source: "glofox",
        notes: m.startEstimated ? "Imported from Glofox (start date estimated)" : "Imported from Glofox",
        createdAt: now,
      };
    });
  await chunked(ms, (part) => db.insert(memberships).values(part));

  await chunked(targets, (part) =>
    db.insert(activity).values(
      part.map(({ memberId, row }) => ({
        memberId,
        type: "member.imported",
        message: row.action === "create" ? "Imported from Glofox" : `Glofox re-import: ${row.note?.toLowerCase()}`,
        at: now,
      })),
    ),
  );

  return { created: created.length, updated: updates.length, memberships: ms.length, cards: creds.filter((c) => c.kind === "card").length };
}

/** Settings → "Remove demo data": demo members, their visits, and demo till sales. */
export async function removeDemoData(db: DB) {
  const demo = await db.select({ id: members.id }).from(members).where(inArray(members.source, ["demo"]));
  for (const table of [cafeOrders, expenses, leads, ptBookings, messages]) await db.delete(table).where(eq((table as typeof leads).demo, true));
  // demo staff take their shifts, timesheets and PT credit with them
  await db.delete(staff).where(eq(staff.demo, true));
  await chunked(demo.map((d) => d.id), async (ids) => {
    await db.delete(checkIns).where(inArray(checkIns.memberId, ids));
    await db.delete(members).where(inArray(members.id, ids));
  });
  await db.delete(sales).where(eq(sales.source, "demo"));
  return demo.length;
}
