import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { GYM } from "@/content/gym";
import { getPlan } from "@/content/plans";
import type { DB } from "@/lib/db/client";
import { activity, checkIns, credentials, members, memberships, type Member, type MembershipRow } from "@/lib/db/schema";
import {
  applyFreeze,
  endFreeze,
  evaluateAccess,
  nextStartDate,
  planEndDate,
  type AccessDecision,
  type DenyReason,
} from "./access";
import { generateAccessCode, generatePassToken, normalizeCode } from "./codes";
import { addDays, diffDays, isISODate, localDate, type ISODate } from "./dates";

/*
 * Everything the front desk can do, as plain async functions over the database.
 * Server actions and API routes call these; tests run them against in-memory Postgres.
 */

export class ServiceError extends Error {}

export type CheckInMethod = "scan" | "camera" | "typed" | "search";

export type CheckInResult = {
  allowed: boolean;
  reason?: DenyReason;
  nudge?: "last-day" | "renew-soon" | null;
  /** same member scanned again within a couple of minutes: not logged twice (previousVisit = that scan) */
  duplicate?: boolean;
  at: string;
  code?: string;
  member?: {
    id: string;
    memberNo: number;
    name: string;
    nickname: string | null;
    photoUrl: string | null;
  };
  plan?: string;
  coverEnds?: ISODate;
  daysLeft?: number;
  startsOn?: ISODate;
  endedOn?: ISODate;
  daysSinceExpiry?: number;
  frozenUntil?: ISODate;
  pt?: { sessionsLeft: number; endsOn: ISODate };
  visitsThisMonth?: number;
  previousVisit?: string;
};

export function fullName(m: Pick<Member, "firstName" | "lastName">) {
  return [m.firstName, m.lastName].filter(Boolean).join(" ");
}

export async function logActivity(db: DB, memberId: string | null, type: string, message: string, at = new Date()) {
  await db.insert(activity).values({ memberId, type, message, at });
}

export async function findMemberByCode(db: DB, raw: string): Promise<Member | null> {
  const code = normalizeCode(raw);
  if (!code) return null;
  const rows = await db
    .select({ member: members })
    .from(credentials)
    .innerJoin(members, eq(members.id, credentials.memberId))
    .where(and(eq(credentials.code, code), isNull(credentials.revokedAt)))
    .limit(1);
  return rows[0]?.member ?? null;
}

export async function memberMemberships(db: DB, memberId: string): Promise<MembershipRow[]> {
  return db.select().from(memberships).where(eq(memberships.memberId, memberId)).orderBy(memberships.startsOn);
}

export async function checkIn(
  db: DB,
  input: { code?: string; memberId?: string; method: CheckInMethod },
  now = new Date(),
): Promise<CheckInResult> {
  const at = now.toISOString();
  const code = input.code ? normalizeCode(input.code) : undefined;
  let member: Member | null = null;
  if (input.memberId) {
    member = (await db.select().from(members).where(eq(members.id, input.memberId)).limit(1))[0] ?? null;
  } else if (code) {
    member = await findMemberByCode(db, code);
  }

  if (!member) {
    await db.insert(checkIns).values({ code: code ?? null, method: input.method, allowed: false, reason: "unknown-code", at: now });
    return { allowed: false, reason: "unknown-code", at, code };
  }

  const today = localDate(now);
  const ms = await memberMemberships(db, member.id);
  const decision: AccessDecision = member.archivedAt ? { allowed: false, reason: "archived" } : evaluateAccess(ms, today);
  const standing = decision.standing;

  const [prev] = await db
    .select({ at: checkIns.at })
    .from(checkIns)
    .where(and(eq(checkIns.memberId, member.id), eq(checkIns.allowed, true)))
    .orderBy(desc(checkIns.at))
    .limit(1);
  const duplicate =
    decision.allowed && !!prev && now.getTime() - prev.at.getTime() < GYM.duplicateScanSeconds * 1000;

  if (!duplicate) {
    await db.insert(checkIns).values({
      memberId: member.id,
      membershipId: standing?.current?.id ?? null,
      code: code ?? null,
      method: input.method,
      allowed: decision.allowed,
      reason: decision.allowed ? null : decision.reason,
      at: now,
    });
  }

  const monthStart = new Date(`${today.slice(0, 8)}01T00:00:00+07:00`);
  const [{ visits }] = await db
    .select({ visits: sql<number>`count(*)::int` })
    .from(checkIns)
    .where(and(eq(checkIns.memberId, member.id), eq(checkIns.allowed, true), gte(checkIns.at, monthStart)));

  return {
    allowed: decision.allowed,
    reason: decision.allowed ? undefined : decision.reason,
    nudge: decision.allowed ? decision.nudge : undefined,
    duplicate,
    at,
    code,
    member: {
      id: member.id,
      memberNo: member.memberNo,
      name: fullName(member),
      nickname: member.nickname,
      photoUrl: member.photoUrl,
    },
    plan: standing?.current?.planName,
    coverEnds: standing?.coverEnds,
    daysLeft: standing?.daysLeft,
    startsOn: standing?.startsOn,
    endedOn: standing?.endedOn,
    daysSinceExpiry: standing?.daysSinceExpiry,
    frozenUntil: standing?.frozenUntil,
    pt: standing?.pt ? { sessionsLeft: standing.pt.sessionsLeft, endsOn: standing.pt.endsOn } : undefined,
    visitsThisMonth: visits,
    previousVisit: prev?.at.toISOString(),
  };
}

export type MemberInput = {
  firstName: string;
  lastName?: string;
  nickname?: string | null;
  email?: string | null;
  phone?: string | null;
  lineId?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  emergencyContact?: string | null;
  notes?: string | null;
  marketingOptIn?: boolean;
};

const clean = (s: string | null | undefined) => {
  const v = s?.trim();
  return v ? v : null;
};

/** Thai numbers stored as +66…; anything else kept as typed (digits and +). */
export function normalizePhone(raw: string | null | undefined): string | null {
  const v = clean(raw);
  if (!v) return null;
  const digits = v.replace(/[^\d+]/g, "");
  if (/^0\d{8,9}$/.test(digits)) return `+66${digits.slice(1)}`;
  if (/^66\d{8,9}$/.test(digits)) return `+${digits}`;
  return digits || null;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  const v = clean(raw)?.toLowerCase();
  return v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}

function memberValues(input: MemberInput) {
  const firstName = input.firstName?.trim();
  if (!firstName) throw new ServiceError("First name is required.");
  if (input.email && !normalizeEmail(input.email)) throw new ServiceError("That email doesn't look right.");
  if (input.birthDate && !isISODate(input.birthDate)) throw new ServiceError("Birth date must be a valid date.");
  return {
    firstName,
    lastName: input.lastName?.trim() ?? "",
    nickname: clean(input.nickname),
    email: normalizeEmail(input.email),
    phone: normalizePhone(input.phone),
    lineId: clean(input.lineId),
    birthDate: clean(input.birthDate),
    gender: clean(input.gender),
    emergencyContact: clean(input.emergencyContact),
    notes: clean(input.notes),
    marketingOptIn: input.marketingOptIn ?? true,
  };
}

/** Members with the same email or phone, to warn before creating a duplicate. */
export async function findDuplicates(db: DB, input: { email?: string | null; phone?: string | null }, exceptId?: string) {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  if (!email && !phone) return [];
  const rows = await db
    .select()
    .from(members)
    .where(
      sql`(${email ? sql`lower(${members.email}) = ${email}` : sql`false`} or ${phone ? sql`${members.phone} = ${phone}` : sql`false`})`,
    );
  return rows.filter((r) => r.id !== exceptId);
}

async function insertQr(db: DB, memberId: string, at: Date) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateAccessCode();
    const taken = await db.select({ id: credentials.id }).from(credentials).where(eq(credentials.code, code)).limit(1);
    if (taken.length) continue;
    await db.insert(credentials).values({ memberId, kind: "qr", code, createdAt: at });
    return code;
  }
  throw new ServiceError("Couldn't create a unique code. Try again.");
}

export async function createMember(
  db: DB,
  input: MemberInput & { source?: string; externalId?: string | null; cardCode?: string | null },
  now = new Date(),
): Promise<Member> {
  const values = memberValues(input);
  const [member] = await db
    .insert(members)
    .values({
      ...values,
      source: input.source ?? "admin",
      externalId: input.externalId ?? null,
      passToken: generatePassToken(),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  await insertQr(db, member.id, now);
  if (input.cardCode) await addCard(db, member.id, input.cardCode, now);
  await logActivity(db, member.id, "member.created", input.source === "glofox" ? "Imported from Glofox" : "Member created", now);
  return member;
}

export async function updateMember(db: DB, id: string, input: MemberInput) {
  const values = memberValues(input);
  await db.update(members).set({ ...values, updatedAt: new Date() }).where(eq(members.id, id));
  await logActivity(db, id, "member.updated", "Details updated");
}

export async function setArchived(db: DB, id: string, archived: boolean) {
  await db.update(members).set({ archivedAt: archived ? new Date() : null }).where(eq(members.id, id));
  await logActivity(db, id, archived ? "member.archived" : "member.restored", archived ? "Member archived" : "Member restored");
}

/** New QR code for the member; the old one stops working straight away (lost phone, shared screenshot). */
export async function regenerateQr(db: DB, memberId: string, now = new Date()) {
  await db
    .update(credentials)
    .set({ revokedAt: now })
    .where(and(eq(credentials.memberId, memberId), eq(credentials.kind, "qr"), isNull(credentials.revokedAt)));
  const code = await insertQr(db, memberId, now);
  await logActivity(db, memberId, "credential.qr", "New QR code issued, old one disabled", now);
  return code;
}

/** Link a physical card (e.g. an existing Glofox card) so it keeps working at the scanner. */
export async function addCard(db: DB, memberId: string, raw: string, now = new Date()) {
  const code = normalizeCode(raw);
  if (code.length < 3) throw new ServiceError("Card number is too short.");
  const [existing] = await db.select().from(credentials).where(eq(credentials.code, code)).limit(1);
  if (existing && existing.memberId !== memberId) throw new ServiceError("That card belongs to another member.");
  if (existing) {
    await db.update(credentials).set({ revokedAt: null }).where(eq(credentials.id, existing.id));
  } else {
    await db.insert(credentials).values({ memberId, kind: "card", code, createdAt: now });
  }
  await logActivity(db, memberId, "credential.card", `Card ${code} linked`, now);
  return code;
}

export async function revokeCredential(db: DB, credentialId: string) {
  const [c] = await db.update(credentials).set({ revokedAt: new Date() }).where(eq(credentials.id, credentialId)).returning();
  if (c) await logActivity(db, c.memberId, "credential.revoked", `${c.kind === "card" ? "Card" : "Code"} ${c.code} disabled`);
}

export type SellInput = {
  planId: string;
  startsOn?: ISODate;
  price?: number;
  paymentMethod: string;
  paymentRef?: string | null;
  notes?: string | null;
};

export async function sellPlan(db: DB, memberId: string, input: SellInput, now = new Date()): Promise<MembershipRow> {
  const plan = getPlan(input.planId);
  if (!plan) throw new ServiceError("Pick a plan.");
  const today = localDate(now);
  const existing = await memberMemberships(db, memberId);
  const startsOn = input.startsOn || nextStartDate(existing, plan.kind, today);
  if (!isISODate(startsOn)) throw new ServiceError("Start date isn't valid.");
  if (diffDays(today, startsOn) < -365) throw new ServiceError("Start date is more than a year ago.");
  const price = input.price ?? plan.price;
  if (!Number.isFinite(price) || price < 0) throw new ServiceError("Price can't be negative.");

  const [row] = await db
    .insert(memberships)
    .values({
      memberId,
      planId: plan.id,
      planName: plan.name,
      kind: plan.kind,
      startsOn,
      endsOn: planEndDate(startsOn, plan.duration),
      sessionsTotal: plan.sessions ?? null,
      price: Math.round(price),
      paymentMethod: input.paymentMethod,
      paymentRef: clean(input.paymentRef),
      notes: clean(input.notes),
      createdAt: now,
    })
    .returning();
  const when = startsOn === today ? "from today" : `from ${startsOn}`;
  await logActivity(db, memberId, "membership.sold", `${plan.name} sold ${when} · ฿${Math.round(price).toLocaleString("en-US")} ${input.paymentMethod}`, now);
  return row;
}

async function getMembership(db: DB, id: string) {
  const [m] = await db.select().from(memberships).where(eq(memberships.id, id)).limit(1);
  if (!m) throw new ServiceError("Membership not found.");
  return m;
}

export async function freezeMembership(db: DB, id: string, from: ISODate, until: ISODate) {
  if (!isISODate(from) || !isISODate(until) || until < from) throw new ServiceError("Pick a valid pause period.");
  if (diffDays(from, until) > 180) throw new ServiceError("A pause can be at most 6 months.");
  const m = await getMembership(db, id);
  if (m.frozenFrom) throw new ServiceError("This plan is already paused. End that pause first.");
  if (from > m.endsOn) throw new ServiceError("The pause starts after the plan ends.");
  await db.update(memberships).set(applyFreeze(m, from, until)).where(eq(memberships.id, id));
  await logActivity(db, m.memberId, "membership.frozen", `${m.planName} paused ${from} → ${until} (${diffDays(from, until) + 1} days added)`);
}

export async function unfreezeMembership(db: DB, id: string, now = new Date()) {
  const m = await getMembership(db, id);
  await db.update(memberships).set(endFreeze(m, localDate(now))).where(eq(memberships.id, id));
  await logActivity(db, m.memberId, "membership.unfrozen", `${m.planName} pause ended`, now);
}

export async function extendMembership(db: DB, id: string, days: number, reason?: string) {
  if (!Number.isInteger(days) || days === 0 || Math.abs(days) > 365) throw new ServiceError("Days must be a whole number.");
  const m = await getMembership(db, id);
  const endsOn = addDays(m.endsOn, days);
  if (endsOn < m.startsOn) throw new ServiceError("That would end the plan before it starts.");
  await db.update(memberships).set({ endsOn }).where(eq(memberships.id, id));
  await logActivity(db, m.memberId, "membership.extended", `${m.planName} ${days > 0 ? "extended" : "shortened"} ${Math.abs(days)} days${reason ? ` · ${reason}` : ""}`);
}

export async function cancelMembership(db: DB, id: string, reason?: string) {
  const m = await getMembership(db, id);
  await db.update(memberships).set({ cancelledAt: new Date(), cancelReason: clean(reason) }).where(eq(memberships.id, id));
  await logActivity(db, m.memberId, "membership.cancelled", `${m.planName} cancelled${reason ? ` · ${reason}` : ""}`);
}

export async function useSession(db: DB, id: string, delta: 1 | -1 = 1) {
  const m = await getMembership(db, id);
  if (m.sessionsTotal == null) throw new ServiceError("This plan has no sessions.");
  const used = m.sessionsUsed + delta;
  if (used < 0 || used > m.sessionsTotal) throw new ServiceError(delta > 0 ? "No sessions left on this pack." : "Nothing to undo.");
  await db.update(memberships).set({ sessionsUsed: used }).where(eq(memberships.id, id));
  await logActivity(
    db,
    m.memberId,
    delta > 0 ? "pt.session" : "pt.undo",
    delta > 0 ? `PT session used · ${m.sessionsTotal - used} left` : `PT session given back · ${m.sessionsTotal - used} left`,
  );
}
