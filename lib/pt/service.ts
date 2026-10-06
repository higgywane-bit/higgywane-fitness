import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import {
  clientAccounts,
  dailyFeedback,
  members,
  ptClients,
  ptLibraryItems,
  ptNotifications,
  ptPlans,
  staff,
  workoutLogs,
  type Member,
  type PtClient,
  type Staff,
} from "@/lib/db/schema";
import type { Mailer } from "@/lib/email";
import { inviteEmail, loginHelpEmail } from "@/lib/email/templates";
import { addDays, isISODate, localDate, type ISODate } from "@/lib/membership/dates";
import { fullName, logActivity, normalizeEmail, ServiceError } from "@/lib/membership/service";
import { checkPassword, endAllSessions, hashPassword, hashToken, newToken, verifyPassword } from "./auth";
import { DEFAULT_VISIBILITY, INVITE_DAYS, visibilityOf, type ClientStatus, type Visibility } from "./clients";
import { diffDiet, emptyDiet, sanitizeDiet, type DietPlan } from "./diet";
import { defaultSetup, sanitizeAnswers, sanitizeSetup, type Answers, type FeedbackDay, type FeedbackSetup } from "./feedback";
import { customCue, customExercise, type Cue, type LibraryExercise } from "./library";
import { diffPlans, emptyPlan, sanitizePlan, type WorkoutPlan } from "./program";
import { sanitizeLog, setsDone, workoutVolume, type PastWorkout } from "./progress";

/*
 * Everything the PT app does to the database, as plain async functions.
 * Server actions (app/coach/actions.ts, app/app/actions.ts) are thin wrappers that
 * check who is signed in, then call these. Tests run them against in-memory Postgres.
 */

export type PlanKind = "workout" | "diet" | "feedback";
export type PlanDocs = { workout: WorkoutPlan; diet: DietPlan; feedback: FeedbackSetup };

/** Roles that may sign in to the coach portal; owner and manager see every client. */
export const COACH_ROLES = ["coach", "owner", "manager"] as const;
export const seesAllClients = (s: Pick<Staff, "role">) => s.role === "owner" || s.role === "manager";

const PLAN_LABEL: Record<PlanKind, string> = { workout: "workout", diet: "nutrition plan", feedback: "daily feedback" };

/* ── linking a member to a coach ─────────────────────────── */

async function getClient(db: DB, id: string): Promise<PtClient> {
  const [c] = await db.select().from(ptClients).where(eq(ptClients.id, id)).limit(1);
  if (!c) throw new ServiceError("Client not found.");
  return c;
}

async function getMember(db: DB, id: string): Promise<Member> {
  const [m] = await db.select().from(members).where(eq(members.id, id)).limit(1);
  if (!m) throw new ServiceError("Member not found.");
  return m;
}

async function staffName(db: DB, id: string | null | undefined): Promise<string> {
  if (!id) return "Your coach";
  const [s] = await db.select({ name: staff.name }).from(staff).where(eq(staff.id, id)).limit(1);
  return s?.name ?? "Your coach";
}

export async function hasAccount(db: DB, memberId: string): Promise<boolean> {
  const [a] = await db.select({ id: clientAccounts.id }).from(clientAccounts).where(eq(clientAccounts.memberId, memberId)).limit(1);
  return !!a;
}

/**
 * Make a member a PT client of a coach. Idempotent: an existing client keeps their
 * history and is moved to the new coach (or brought back from archived).
 */
export async function linkClient(db: DB, input: { memberId: string; coachId: string | null }, now = new Date()): Promise<{ client: PtClient; created: boolean }> {
  const member = await getMember(db, input.memberId);
  if (input.coachId) {
    const [coach] = await db.select().from(staff).where(eq(staff.id, input.coachId)).limit(1);
    if (!coach || !coach.active) throw new ServiceError("Pick an active coach.");
  }
  const joined = await hasAccount(db, member.id);
  const [existing] = await db.select().from(ptClients).where(eq(ptClients.memberId, member.id)).limit(1);
  if (existing) {
    const patch: Partial<PtClient> = { updatedAt: now };
    if (input.coachId && existing.coachId !== input.coachId) patch.coachId = input.coachId;
    if (existing.status === "archived") patch.status = joined ? "active" : "invited";
    const [client] = await db.update(ptClients).set(patch).where(eq(ptClients.id, existing.id)).returning();
    if (patch.coachId) await logActivity(db, member.id, "pt.coach", `PT coach is now ${await staffName(db, patch.coachId)}`, now);
    return { client, created: false };
  }
  const [client] = await db
    .insert(ptClients)
    .values({
      memberId: member.id,
      coachId: input.coachId,
      status: joined ? "active" : "invited",
      joinedAt: joined ? now : null,
      visibility: { ...DEFAULT_VISIBILITY },
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  await logActivity(db, member.id, "pt.client", `PT client of ${await staffName(db, input.coachId)}`, now);
  return { client, created: true };
}

/** A fresh one-time join link. Any earlier link stops working. */
export async function issueInvite(db: DB, clientId: string, now = new Date()): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const expiresAt = new Date(now.getTime() + INVITE_DAYS * 86_400_000);
  await db.update(ptClients).set({ inviteTokenHash: hashToken(token), inviteExpiresAt: expiresAt, updatedAt: now }).where(eq(ptClients.id, clientId));
  return { token, expiresAt };
}

export const joinLink = (baseUrl: string, token: string) => `${baseUrl.replace(/\/$/, "")}/app/join/${token}`;

/**
 * Send the client their link: by email when we have one, and always return the link so
 * the coach or desk can share it by LINE or SMS too.
 */
export async function sendInvite(
  db: DB,
  mailer: Mailer,
  clientId: string,
  baseUrl: string,
  opts: { channel?: "email" | "link" } = {},
  now = new Date(),
): Promise<{ link: string; emailed: boolean; email: string | null; preview: boolean }> {
  const client = await getClient(db, clientId);
  const member = await getMember(db, client.memberId);
  const { token } = await issueInvite(db, client.id, now);
  const link = joinLink(baseUrl, token);
  const coachName = await staffName(db, client.coachId);
  const wantsEmail = opts.channel !== "link" && !!member.email;
  if (wantsEmail) {
    const email = inviteEmail({ firstName: member.nickname || member.firstName, coachName, link, days: INVITE_DAYS, reset: client.status === "active" });
    await mailer.send({ to: member.email!, ...email });
  }
  await db
    .update(ptClients)
    .set({ inviteSentAt: now, inviteChannel: wantsEmail ? "email" : "link", updatedAt: now })
    .where(eq(ptClients.id, client.id));
  await logActivity(db, member.id, "pt.invite", wantsEmail ? `App invite emailed to ${member.email}` : "App invite link created", now);
  return { link, emailed: wantsEmail, email: member.email, preview: wantsEmail && !mailer.live };
}

/**
 * The desk sold a PT pack with a coach chosen: link the member to that coach and, if
 * they're not on the app yet, send the invite. Returns the link for the receipt screen.
 */
export async function onPtPackSold(
  db: DB,
  mailer: Mailer,
  input: { memberId: string; coachId: string | null; planName: string; sessions?: number | null; baseUrl: string },
  now = new Date(),
) {
  const { client } = await linkClient(db, { memberId: input.memberId, coachId: input.coachId }, now);
  if (client.status === "invited") {
    const sent = await sendInvite(db, mailer, client.id, input.baseUrl, {}, now);
    return { clientId: client.id, invited: true, ...sent };
  }
  await notify(db, {
    clientId: client.id,
    audience: "client",
    kind: "pack.added",
    title: `${input.planName} added`,
    body: input.sessions ? `${input.sessions} more PT session${input.sessions === 1 ? "" : "s"} with ${await staffName(db, client.coachId)}.` : null,
    href: "/app",
  }, now);
  return { clientId: client.id, invited: false, link: null, emailed: false, email: null, preview: false };
}

export type InviteInfo = { clientId: string; memberId: string; firstName: string; email: string | null; coachName: string; hasAccount: boolean };

/** Who a join link belongs to, or null when it's wrong, used or expired. */
export async function readInvite(db: DB, token: string, now = new Date()): Promise<InviteInfo | null> {
  if (!token || token.length < 20 || token.length > 64) return null;
  const [row] = await db
    .select({ c: ptClients, m: members })
    .from(ptClients)
    .innerJoin(members, eq(members.id, ptClients.memberId))
    .where(eq(ptClients.inviteTokenHash, hashToken(token)))
    .limit(1);
  if (!row || !row.c.inviteExpiresAt || row.c.inviteExpiresAt < now || row.c.status === "archived") return null;
  const [account] = await db.select({ email: clientAccounts.email }).from(clientAccounts).where(eq(clientAccounts.memberId, row.m.id)).limit(1);
  return {
    clientId: row.c.id,
    memberId: row.m.id,
    firstName: row.m.nickname || row.m.firstName,
    email: account?.email ?? row.m.email,
    coachName: await staffName(db, row.c.coachId),
    hasAccount: !!account,
  };
}

/** Set a password from the link: creates the app account (or resets it) and signs the client up. */
export async function acceptInvite(db: DB, token: string, input: { email: string; password: string }, now = new Date()): Promise<{ memberId: string }> {
  const invite = await readInvite(db, token, now);
  if (!invite) throw new ServiceError("This link has expired or was already used. Ask your coach for a new one.");
  const email = normalizeEmail(input.email);
  if (!email) throw new ServiceError("Enter a valid email.");
  const problem = checkPassword(input.password);
  if (problem) throw new ServiceError(problem);

  const [taken] = await db.select({ memberId: clientAccounts.memberId }).from(clientAccounts).where(sql`lower(${clientAccounts.email}) = ${email}`).limit(1);
  if (taken && taken.memberId !== invite.memberId) throw new ServiceError("That email is already used by another account.");

  const passwordHash = await hashPassword(input.password);
  if (invite.hasAccount) {
    await db.update(clientAccounts).set({ email, passwordHash }).where(eq(clientAccounts.memberId, invite.memberId));
    await endAllSessions(db, "client", invite.memberId);
  } else {
    await db.insert(clientAccounts).values({ memberId: invite.memberId, email, passwordHash, createdAt: now });
  }
  const client = await getClient(db, invite.clientId);
  await db
    .update(ptClients)
    .set({ status: "active", joinedAt: client.joinedAt ?? now, inviteTokenHash: null, inviteExpiresAt: null, updatedAt: now })
    .where(eq(ptClients.id, invite.clientId));
  const member = await getMember(db, invite.memberId);
  if (!member.email) await db.update(members).set({ email, updatedAt: now }).where(eq(members.id, member.id));
  if (!invite.hasAccount) {
    await notify(db, { clientId: invite.clientId, audience: "coach", kind: "invite.accepted", title: `${fullName(member)} joined the app`, body: "Build their workout and it shows on their phone straight away.", href: `/coach/clients/${invite.clientId}` }, now);
    await logActivity(db, member.id, "pt.joined", "Joined the PT app", now);
  } else {
    await logActivity(db, member.id, "pt.password", "Set a new app password", now);
  }
  return { memberId: invite.memberId };
}

export async function clientLogin(db: DB, emailRaw: string, password: string, now = new Date()): Promise<{ memberId: string }> {
  const email = normalizeEmail(emailRaw);
  const [account] = email ? await db.select().from(clientAccounts).where(sql`lower(${clientAccounts.email}) = ${email}`).limit(1) : [];
  // same message and similar work either way, so it doesn't reveal who has an account
  const ok = account ? await verifyPassword(password ?? "", account.passwordHash) : (await hashPassword("x"), false);
  if (!account || !ok) throw new ServiceError("Email or password is wrong.");
  const [client] = await db.select({ status: ptClients.status }).from(ptClients).where(eq(ptClients.memberId, account.memberId)).limit(1);
  if (!client || client.status === "archived") throw new ServiceError("Your PT app access is paused. Talk to your coach.");
  await db.update(clientAccounts).set({ lastLoginAt: now }).where(eq(clientAccounts.id, account.id));
  return { memberId: account.memberId };
}

/** "Forgot password": emails a fresh link if the email has an account. Never says whether it does. */
export async function requestLoginHelp(db: DB, mailer: Mailer, emailRaw: string, baseUrl: string, now = new Date()) {
  const email = normalizeEmail(emailRaw);
  if (!email) throw new ServiceError("Enter a valid email.");
  const [row] = await db
    .select({ c: ptClients, m: members })
    .from(clientAccounts)
    .innerJoin(ptClients, eq(ptClients.memberId, clientAccounts.memberId))
    .innerJoin(members, eq(members.id, clientAccounts.memberId))
    .where(sql`lower(${clientAccounts.email}) = ${email}`)
    .limit(1);
  if (!row || row.c.status === "archived") return;
  const { token } = await issueInvite(db, row.c.id, now);
  await mailer.send({ to: email, ...loginHelpEmail({ firstName: row.m.nickname || row.m.firstName, link: joinLink(baseUrl, token), days: INVITE_DAYS }) });
}

export async function coachLogin(db: DB, staffId: string, pinCheck: (s: Staff) => boolean): Promise<Staff> {
  const [s] = await db.select().from(staff).where(eq(staff.id, staffId)).limit(1);
  if (!s || !s.active || !(COACH_ROLES as readonly string[]).includes(s.role)) throw new ServiceError("That person can't use the coach portal.");
  if (!pinCheck(s)) throw new ServiceError("Wrong PIN.");
  return s;
}

/* ── who may touch which client ──────────────────────────── */

/** The client, if this coach may see them. Owners and managers see everyone. */
export async function clientForCoach(db: DB, coach: Pick<Staff, "id" | "role">, clientId: string): Promise<PtClient> {
  const c = await getClient(db, clientId).catch(() => null);
  if (!c || (!seesAllClients(coach) && c.coachId !== coach.id)) throw new ServiceError("Client not found.");
  return c;
}

/** The signed-in member's PT client record, unless archived. */
export async function clientForMember(db: DB, memberId: string): Promise<PtClient | null> {
  const [c] = await db.select().from(ptClients).where(eq(ptClients.memberId, memberId)).limit(1);
  return c && c.status !== "archived" ? c : null;
}

export async function setVisibility(db: DB, clientId: string, patch: Partial<Visibility>, now = new Date()) {
  const c = await getClient(db, clientId);
  const next = visibilityOf({ ...visibilityOf(c.visibility), ...patch });
  await db.update(ptClients).set({ visibility: next, updatedAt: now }).where(eq(ptClients.id, clientId));
  return next;
}

export async function setClientStatus(db: DB, clientId: string, archived: boolean, now = new Date()) {
  const c = await getClient(db, clientId);
  const status: ClientStatus = archived ? "archived" : (await hasAccount(db, c.memberId)) ? "active" : "invited";
  await db.update(ptClients).set({ status, updatedAt: now }).where(eq(ptClients.id, clientId));
  if (archived) await endAllSessions(db, "client", c.memberId);
  await logActivity(db, c.memberId, archived ? "pt.archived" : "pt.restored", archived ? "Removed from PT app" : "Back on the PT app", now);
  return status;
}

export async function reassignCoach(db: DB, clientId: string, coachId: string, now = new Date()) {
  const c = await getClient(db, clientId);
  return linkClient(db, { memberId: c.memberId, coachId }, now);
}

export async function touchClient(db: DB, clientId: string, now = new Date()) {
  await db.update(ptClients).set({ lastSeenAt: now }).where(eq(ptClients.id, clientId));
}

/* ── plans (workout, nutrition, feedback questions) ──────── */

const DEFAULTS: { [K in PlanKind]: () => PlanDocs[K] } = { workout: emptyPlan, diet: emptyDiet, feedback: defaultSetup };
const SANITIZE: { [K in PlanKind]: (x: unknown) => PlanDocs[K] } = { workout: sanitizePlan, diet: sanitizeDiet, feedback: sanitizeSetup };

export function sanitizeDoc<K extends PlanKind>(kind: K, doc: unknown): PlanDocs[K] {
  try {
    return SANITIZE[kind](doc) as PlanDocs[K];
  } catch (e) {
    throw new ServiceError(e instanceof Error ? e.message : "That plan couldn't be read.");
  }
}

export type StoredPlan<K extends PlanKind> = { doc: PlanDocs[K]; version: number; updatedAt: Date | null; exists: boolean };

export async function getPlan<K extends PlanKind>(db: DB, clientId: string, kind: K): Promise<StoredPlan<K>> {
  const [row] = await db.select().from(ptPlans).where(and(eq(ptPlans.clientId, clientId), eq(ptPlans.kind, kind))).limit(1);
  if (!row) return { doc: DEFAULTS[kind]() as PlanDocs[K], version: 0, updatedAt: null, exists: false };
  return { doc: SANITIZE[kind](row.doc) as PlanDocs[K], version: row.version, updatedAt: row.updatedAt, exists: true };
}

export async function getPlans(db: DB, clientId: string) {
  const [workout, diet, feedback] = await Promise.all([getPlan(db, clientId, "workout"), getPlan(db, clientId, "diet"), getPlan(db, clientId, "feedback")]);
  return { workout, diet, feedback };
}

function changesFor<K extends PlanKind>(kind: K, before: PlanDocs[K] | null, after: PlanDocs[K]): string[] {
  if (kind === "workout") return diffPlans(before as WorkoutPlan | null, after as WorkoutPlan);
  if (kind === "diet") return diffDiet(before as DietPlan | null, after as DietPlan);
  return JSON.stringify(before) === JSON.stringify(after) ? [] : ["Daily questions updated"];
}

/**
 * Save a client's plan. The version goes up, the client gets an in-app notice listing
 * what changed (if anything did), and it's on their phone the next time the app loads.
 * `expectedVersion` stops two devices overwriting each other's edits.
 */
export async function savePlan<K extends PlanKind>(
  db: DB,
  input: { clientId: string; kind: K; doc: unknown; coachId: string | null; expectedVersion?: number },
  now = new Date(),
): Promise<{ version: number; changes: string[]; notified: boolean }> {
  const doc = sanitizeDoc(input.kind, input.doc);
  const client = await getClient(db, input.clientId);
  const [row] = await db.select().from(ptPlans).where(and(eq(ptPlans.clientId, client.id), eq(ptPlans.kind, input.kind))).limit(1);
  if (input.expectedVersion !== undefined && (row?.version ?? 0) !== input.expectedVersion) {
    throw new ServiceError("This plan was changed on another device. Reload to see the latest, then make your edit again.");
  }
  const before = row ? (SANITIZE[input.kind](row.doc) as PlanDocs[K]) : null;
  const changes = changesFor(input.kind, before, doc);
  if (row && !changes.length && JSON.stringify(before) === JSON.stringify(doc)) return { version: row.version, changes, notified: false };

  let version = 1;
  if (row) {
    version = row.version + 1;
    await db.update(ptPlans).set({ doc, version, coachId: input.coachId ?? row.coachId, updatedAt: now }).where(eq(ptPlans.id, row.id));
  } else {
    await db.insert(ptPlans).values({ clientId: client.id, coachId: input.coachId, kind: input.kind, doc, version, createdAt: now, updatedAt: now });
  }

  const coachName = await staffName(db, input.coachId ?? client.coachId);
  const notified = client.status === "active" && changes.length > 0;
  if (notified) {
    await notify(db, {
      clientId: client.id,
      audience: "client",
      kind: "plan.updated",
      title: `${coachName} updated your ${PLAN_LABEL[input.kind]}`,
      body: changes.slice(0, 4).join(". ") + (changes.length > 4 ? `. And ${changes.length - 4} more` : ""),
      href: input.kind === "workout" ? "/app/workout" : input.kind === "diet" ? "/app/nutrition" : "/app/feedback",
    }, now);
  }
  await logActivity(db, client.memberId, `pt.${input.kind}`, `${PLAN_LABEL[input.kind][0].toUpperCase()}${PLAN_LABEL[input.kind].slice(1)} updated by ${coachName}`, now);
  return { version, changes, notified };
}

/* ── programs (templates) ────────────────────────────────── */

export async function listTemplates(db: DB, coachId: string) {
  return db
    .select()
    .from(ptPlans)
    .where(and(isNull(ptPlans.clientId), eq(ptPlans.coachId, coachId)))
    .orderBy(ptPlans.kind, ptPlans.name);
}

export async function getTemplate(db: DB, coachId: string, id: string) {
  const [row] = await db.select().from(ptPlans).where(and(eq(ptPlans.id, id), isNull(ptPlans.clientId), eq(ptPlans.coachId, coachId))).limit(1);
  if (!row) throw new ServiceError("Program not found.");
  return row;
}

export async function saveTemplate(db: DB, input: { id?: string; coachId: string; kind: "workout" | "diet"; name: string; doc: unknown }, now = new Date()) {
  const name = input.name?.replace(/\s+/g, " ").trim().slice(0, 50);
  if (!name) throw new ServiceError("Name the program.");
  const doc = sanitizeDoc(input.kind, input.doc);
  if (input.id) {
    const row = await getTemplate(db, input.coachId, input.id);
    const [saved] = await db.update(ptPlans).set({ name, doc, version: row.version + 1, updatedAt: now }).where(eq(ptPlans.id, row.id)).returning();
    return saved;
  }
  const [saved] = await db.insert(ptPlans).values({ coachId: input.coachId, kind: input.kind, name, doc, createdAt: now, updatedAt: now }).returning();
  return saved;
}

export async function deleteTemplate(db: DB, coachId: string, id: string) {
  const row = await getTemplate(db, coachId, id);
  await db.delete(ptPlans).where(eq(ptPlans.id, row.id));
}

/** Give a client a copy of a program. Their own edits never change the program. */
export async function applyTemplate(db: DB, input: { templateId: string; clientId: string; coach: Pick<Staff, "id" | "role"> }, now = new Date()) {
  const t = await getTemplate(db, input.coach.id, input.templateId);
  await clientForCoach(db, input.coach, input.clientId);
  return savePlan(db, { clientId: input.clientId, kind: t.kind, doc: t.doc, coachId: input.coach.id }, now);
}

/* ── the coach's own library items ───────────────────────── */

export async function customLibrary(db: DB, coachId: string): Promise<{ exercises: LibraryExercise[]; cues: Cue[] }> {
  const rows = await db.select().from(ptLibraryItems).where(eq(ptLibraryItems.coachId, coachId)).orderBy(ptLibraryItems.createdAt);
  return {
    exercises: rows.filter((r) => r.kind === "exercise").map((r) => r.data as LibraryExercise),
    cues: rows.filter((r) => r.kind === "cue").map((r) => r.data as Cue),
  };
}

export async function addCustomExercise(db: DB, coachId: string, input: Parameters<typeof customExercise>[0]) {
  let ex: LibraryExercise;
  try {
    ex = customExercise(input);
  } catch (e) {
    throw new ServiceError((e as Error).message);
  }
  const mine = await customLibrary(db, coachId);
  if (mine.exercises.some((e) => e.id === ex.id)) throw new ServiceError("You already have an exercise with that name.");
  await db.insert(ptLibraryItems).values({ coachId, kind: "exercise", data: ex });
  return ex;
}

export async function addCustomCue(db: DB, coachId: string, input: Parameters<typeof customCue>[0]) {
  let cue: Cue;
  try {
    cue = customCue(input);
  } catch (e) {
    throw new ServiceError((e as Error).message);
  }
  const mine = await customLibrary(db, coachId);
  if (!mine.cues.some((c) => c.id === cue.id)) await db.insert(ptLibraryItems).values({ coachId, kind: "cue", data: cue });
  return cue;
}

/* ── workouts the client logs ────────────────────────────── */

export async function saveWorkout(db: DB, clientId: string, raw: unknown, now = new Date()): Promise<{ id: string }> {
  let log;
  try {
    log = sanitizeLog(raw);
  } catch (e) {
    throw new ServiceError((e as Error).message);
  }
  if (!setsDone(log)) throw new ServiceError("Tick at least one set before finishing.");
  if (new Date(log.finishedAt).getTime() > now.getTime() + 5 * 60_000) log.finishedAt = now.toISOString();
  const client = await getClient(db, clientId);
  const plan = await getPlan(db, clientId, "workout");
  const volume = workoutVolume(log);
  const [row] = await db
    .insert(workoutLogs)
    .values({
      clientId,
      dayId: log.dayId,
      dayName: log.dayName,
      startedAt: new Date(log.startedAt),
      finishedAt: new Date(log.finishedAt),
      entries: log.entries,
      note: log.note ?? null,
      volumeKg: Math.round(volume),
      setsDone: setsDone(log),
      planVersion: plan.version || null,
      createdAt: now,
    })
    .returning({ id: workoutLogs.id });
  const member = await getMember(db, client.memberId);
  await notify(db, {
    clientId,
    audience: "coach",
    kind: "workout.done",
    title: `${fullName(member)} finished ${log.dayName}`,
    body: [volume ? `${Math.round(volume).toLocaleString("en-US")} kg` : null, `${setsDone(log)} sets`, log.note ? `Note: ${log.note}` : null].filter(Boolean).join(" · "),
    href: `/coach/clients/${clientId}`,
  }, now);
  return { id: row.id };
}

function toPast(r: typeof workoutLogs.$inferSelect): PastWorkout {
  return {
    id: r.id,
    dayId: r.dayId,
    dayName: r.dayName,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt.toISOString(),
    entries: r.entries as PastWorkout["entries"],
    ...(r.note ? { note: r.note } : {}),
  };
}

/** Newest first. */
export async function workoutHistory(db: DB, clientId: string, limit = 100): Promise<PastWorkout[]> {
  const rows = await db.select().from(workoutLogs).where(eq(workoutLogs.clientId, clientId)).orderBy(desc(workoutLogs.finishedAt)).limit(limit);
  return rows.map(toPast);
}

export async function getWorkout(db: DB, clientId: string, id: string): Promise<PastWorkout | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await db.select().from(workoutLogs).where(and(eq(workoutLogs.id, id), eq(workoutLogs.clientId, clientId))).limit(1);
  return r ? toPast(r) : null;
}

/* ── daily feedback ──────────────────────────────────────── */

/** Clients can fill in today and catch up on the 2 days before. */
export const FEEDBACK_EDIT_DAYS = 3;

export function canEditFeedback(date: ISODate, today: ISODate): boolean {
  return date <= today && date > addDays(today, -FEEDBACK_EDIT_DAYS);
}

export async function saveFeedback(
  db: DB,
  input: { clientId: string; date: ISODate; answers: unknown; complete?: boolean },
  now = new Date(),
): Promise<{ answers: Answers; completedAt: Date | null }> {
  const today = localDate(now);
  if (!isISODate(input.date) || !canEditFeedback(input.date, today)) throw new ServiceError("That day can't be changed any more.");
  const setup = (await getPlan(db, input.clientId, "feedback")).doc;
  const answers = sanitizeAnswers(setup, input.answers);
  const [existing] = await db.select().from(dailyFeedback).where(and(eq(dailyFeedback.clientId, input.clientId), eq(dailyFeedback.date, input.date))).limit(1);
  const completedAt = input.complete ? (existing?.completedAt ?? now) : (existing?.completedAt ?? null);
  if (existing) {
    await db.update(dailyFeedback).set({ answers, completedAt, updatedAt: now }).where(eq(dailyFeedback.id, existing.id));
  } else {
    await db.insert(dailyFeedback).values({ clientId: input.clientId, date: input.date, answers, completedAt, updatedAt: now });
  }
  if (input.complete && !existing?.completedAt) {
    const client = await getClient(db, input.clientId);
    const member = await getMember(db, client.memberId);
    await notify(db, { clientId: input.clientId, audience: "coach", kind: "feedback.done", title: `${fullName(member)} completed daily feedback`, body: null, href: `/coach/clients/${input.clientId}/feedback/${input.date}` }, now);
  }
  return { answers, completedAt };
}

export async function feedbackRange(db: DB, clientId: string, from: ISODate, to: ISODate): Promise<FeedbackDay[]> {
  const rows = await db
    .select()
    .from(dailyFeedback)
    .where(and(eq(dailyFeedback.clientId, clientId), gte(dailyFeedback.date, from), lte(dailyFeedback.date, to)))
    .orderBy(desc(dailyFeedback.date));
  return rows.map((r) => ({ date: r.date, answers: r.answers, completedAt: r.completedAt }));
}

/* ── notifications ───────────────────────────────────────── */

export async function notify(
  db: DB,
  n: { clientId: string; audience: "client" | "coach"; kind: string; title: string; body?: string | null; href?: string | null },
  now = new Date(),
) {
  await db.insert(ptNotifications).values({ ...n, body: n.body ?? null, href: n.href ?? null, createdAt: now });
}

/** The client's notices, newest first. */
export async function clientInbox(db: DB, clientId: string, limit = 20) {
  return db
    .select()
    .from(ptNotifications)
    .where(and(eq(ptNotifications.clientId, clientId), eq(ptNotifications.audience, "client")))
    .orderBy(desc(ptNotifications.createdAt))
    .limit(limit);
}

/** Notices for a coach across their clients (all clients for owner/manager). */
export async function coachInbox(db: DB, coach: Pick<Staff, "id" | "role">, opts: { unreadOnly?: boolean; limit?: number } = {}) {
  const rows = await db
    .select({ n: ptNotifications, coachId: ptClients.coachId })
    .from(ptNotifications)
    .innerJoin(ptClients, eq(ptClients.id, ptNotifications.clientId))
    .where(
      and(
        eq(ptNotifications.audience, "coach"),
        seesAllClients(coach) ? undefined : eq(ptClients.coachId, coach.id),
        opts.unreadOnly ? isNull(ptNotifications.readAt) : undefined,
      ),
    )
    .orderBy(desc(ptNotifications.createdAt))
    .limit(opts.limit ?? 30);
  return rows.map((r) => r.n);
}

export async function markRead(db: DB, audience: "client" | "coach", clientIds: string[], ids?: string[], now = new Date()) {
  if (!clientIds.length) return;
  await db
    .update(ptNotifications)
    .set({ readAt: now })
    .where(
      and(
        eq(ptNotifications.audience, audience),
        inArray(ptNotifications.clientId, clientIds),
        isNull(ptNotifications.readAt),
        ids?.length ? inArray(ptNotifications.id, ids) : undefined,
      ),
    );
}

export type { Visibility };
