import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/lib/db/client";
import { authSessions, ptClients, staff } from "@/lib/db/schema";
import type { Email, Mailer } from "@/lib/email";
import { createMember, sellPlan, useSession } from "@/lib/membership/service";
import { createSession, sessionSubject } from "@/lib/pt/auth";
import { findExercise } from "@/lib/pt/library";
import { addDay, addExercises, emptyPlan, setAllTargets, updateExercise } from "@/lib/pt/program";
import {
  acceptInvite,
  applyTemplate,
  clientForCoach,
  clientInbox,
  clientLogin,
  coachInbox,
  getPlan,
  linkClient,
  onPtPackSold,
  readInvite,
  requestLoginHelp,
  saveFeedback,
  savePlan,
  saveTemplate,
  saveWorkout,
  sendInvite,
  setClientStatus,
  workoutHistory,
} from "@/lib/pt/service";

let db: DB;
const sent: Email[] = [];
const mailer: Mailer = { name: "test", live: true, send: async (e) => void sent.push(e) };
const at = (s: string) => new Date(`${s}+07:00`);
const tokenFrom = (text: string) => /\/app\/join\/([\w-]+)/.exec(text)![1];

let bella: { id: string; role: "coach" };
let aun: { id: string; role: "coach" };

beforeAll(async () => {
  db = (await createDb()).db;
  const rows = await db
    .insert(staff)
    .values([
      { name: "Bella", role: "coach" },
      { name: "Aun", role: "coach" },
    ])
    .returning();
  bella = { id: rows[0].id, role: "coach" };
  aun = { id: rows[1].id, role: "coach" };
}, 30_000);

describe("from the till to the client's phone", () => {
  let memberId: string;
  let clientId: string;
  let token: string;

  it("selling a PT pack with a coach links the member and emails an invite", async () => {
    const m = await createMember(db, { firstName: "Pete", lastName: "Hudson", email: "pete@example.com" }, at("2026-10-06T09:00:00"));
    memberId = m.id;
    await sellPlan(db, m.id, { planId: "pt-3", paymentMethod: "qashier" }, at("2026-10-06T09:01:00"));
    const res = await onPtPackSold(db, mailer, { memberId: m.id, coachId: bella.id, planName: "3 Sessions", sessions: 3, baseUrl: "https://super1.test" }, at("2026-10-06T09:01:00"));
    expect(res).toMatchObject({ invited: true, emailed: true, email: "pete@example.com" });
    expect(res.link).toMatch(/^https:\/\/super1\.test\/app\/join\//);
    clientId = res.clientId;
    expect(sent.at(-1)).toMatchObject({ to: "pete@example.com", subject: "Bella invited you to the super1 PT app" });
    token = tokenFrom(sent.at(-1)!.text);
    expect(res.link).toContain(token);

    const [c] = await db.select().from(ptClients).where(eq(ptClients.id, clientId));
    expect(c).toMatchObject({ status: "invited", coachId: bella.id, inviteChannel: "email" });
    expect(c.inviteTokenHash).not.toContain(token); // only the hash is stored
  });

  it("the coach sees them in To set up and can plan before they join, with no notice sent", async () => {
    await expect(clientForCoach(db, aun, clientId)).rejects.toThrow("Client not found.");
    const owner = { id: aun.id, role: "owner" as const };
    expect((await clientForCoach(db, owner, clientId)).id).toBe(clientId);

    let plan = addDay(emptyPlan(), "Chest and Back #1", "d1");
    plan = addExercises(plan, "d1", [findExercise("barbell-bench-press")!, findExercise("lat-pulldown")!]);
    const res = await savePlan(db, { clientId, kind: "workout", doc: plan, coachId: bella.id }, at("2026-10-06T10:00:00"));
    expect(res).toMatchObject({ version: 1, notified: false });
    expect(await clientInbox(db, clientId)).toHaveLength(0);
  });

  it("the link signs them up; a used link stops working", async () => {
    const info = await readInvite(db, token, at("2026-10-06T12:00:00"));
    expect(info).toMatchObject({ firstName: "Pete", email: "pete@example.com", coachName: "Bella", hasAccount: false });
    await expect(acceptInvite(db, token, { email: "pete@example.com", password: "12345678" }, at("2026-10-06T12:01:00"))).rejects.toThrow(/letters/);
    await acceptInvite(db, token, { email: "Pete@Example.com", password: "lift-heavy-8" }, at("2026-10-06T12:01:00"));
    expect(await readInvite(db, token, at("2026-10-06T12:02:00"))).toBeNull();

    const [c] = await db.select().from(ptClients).where(eq(ptClients.id, clientId));
    expect(c.status).toBe("active");
    const coachNotes = await coachInbox(db, bella);
    expect(coachNotes[0]).toMatchObject({ kind: "invite.accepted", title: "Pete Hudson joined the app" });

    expect(await clientLogin(db, "pete@example.com", "lift-heavy-8")).toEqual({ memberId });
    await expect(clientLogin(db, "pete@example.com", "nope-nope-1")).rejects.toThrow("Email or password is wrong.");
    await expect(clientLogin(db, "nobody@example.com", "lift-heavy-8")).rejects.toThrow("Email or password is wrong.");
  });

  it("a coach's update reaches the client as a notice listing the changes", async () => {
    const current = await getPlan(db, clientId, "workout");
    const bench = current.doc.days[0].exercises[0];
    const next = updateExercise(current.doc, "d1", bench.uid, (e) => setAllTargets(e, 6));
    await expect(savePlan(db, { clientId, kind: "workout", doc: next, coachId: bella.id, expectedVersion: 0 })).rejects.toThrow(/another device/);
    const res = await savePlan(db, { clientId, kind: "workout", doc: next, coachId: bella.id, expectedVersion: 1 }, at("2026-10-06T13:00:00"));
    expect(res).toMatchObject({ version: 2, notified: true, changes: ["Barbell bench press: 4 × 8 → 4 × 6"] });
    const [n] = await clientInbox(db, clientId);
    expect(n).toMatchObject({ title: "Bella updated your workout", body: "Barbell bench press: 4 × 8 → 4 × 6", href: "/app/workout" });

    // saving the same plan again changes nothing
    expect(await savePlan(db, { clientId, kind: "workout", doc: next, coachId: bella.id })).toMatchObject({ version: 2, notified: false });
  });

  it("logged workouts and daily feedback reach the coach", async () => {
    const plan = (await getPlan(db, clientId, "workout")).doc;
    const day = plan.days[0];
    await expect(saveWorkout(db, clientId, { dayId: "d1", dayName: day.name, startedAt: "2026-10-06T11:00:00Z", finishedAt: "2026-10-06T12:00:00Z", entries: [] })).rejects.toThrow(/Tick at least one set/);
    const { id } = await saveWorkout(
      db,
      clientId,
      {
        dayId: "d1",
        dayName: day.name,
        startedAt: "2026-10-06T11:00:00Z",
        finishedAt: "2026-10-06T12:00:00Z",
        note: "Felt sick on the last set.",
        entries: day.exercises.map((e) => ({ ...e, sets: [{ weight: 80, reps: 8, done: true }, { weight: 80, reps: 7, done: true }, { weight: 80, reps: 6, done: false }] })),
      },
      at("2026-10-06T19:00:00"),
    );
    const history = await workoutHistory(db, clientId);
    expect(history[0].id).toBe(id);
    expect((await coachInbox(db, bella))[0]).toMatchObject({ kind: "workout.done", title: "Pete Hudson finished Chest and Back #1", body: "2,400 kg · 4 sets · Note: Felt sick on the last set." });

    const now = at("2026-10-06T20:00:00");
    const partial = await saveFeedback(db, { clientId, date: "2026-10-06", answers: { steps: 8420, water: 2.5, hunger: 3 } }, now);
    expect(partial).toEqual({ answers: { steps: 8420, water: 2.5 }, completedAt: null });
    const done = await saveFeedback(db, { clientId, date: "2026-10-06", answers: { steps: 8420, water: 2.5, sleep: 7 }, complete: true }, now);
    expect(done.completedAt).toEqual(now);
    await expect(saveFeedback(db, { clientId, date: "2026-10-01", answers: {} }, now)).rejects.toThrow(/can't be changed/);
    await expect(saveFeedback(db, { clientId, date: "2026-10-07", answers: {} }, now)).rejects.toThrow(/can't be changed/);
    expect((await coachInbox(db, bella))[0].kind).toBe("feedback.done");
  });

  it("logging a PT session uses the pack the desk sold", async () => {
    const plan = (await db.select().from(ptClients).where(eq(ptClients.id, clientId)))[0];
    expect(plan.memberId).toBe(memberId);
    const { memberMemberships } = await import("@/lib/membership/service");
    const [pack] = await memberMemberships(db, memberId);
    await useSession(db, pack.id, 1, { coachId: bella.id });
    expect((await memberMemberships(db, memberId))[0].sessionsUsed).toBe(1);
  });

  it("programs copy onto a client", async () => {
    let doc = addDay(emptyPlan(), "Legs", "legs");
    doc = addExercises(doc, "legs", [findExercise("back-squat")!]);
    const t = await saveTemplate(db, { coachId: bella.id, kind: "workout", name: "Upper / lower 4 days", doc });
    const res = await applyTemplate(db, { templateId: t.id, clientId, coach: bella });
    expect(res.changes).toContain("New day: Legs");
    await expect(applyTemplate(db, { templateId: t.id, clientId, coach: aun })).rejects.toThrow("Program not found.");
  });

  it("forgot password sends a fresh link; resetting signs out other devices", async () => {
    const { token: session } = await createSession(db, "client", memberId);
    expect(await sessionSubject(db, "client", session)).toBe(memberId);
    await requestLoginHelp(db, mailer, "PETE@example.com", "https://super1.test");
    const link = tokenFrom(sent.at(-1)!.text);
    expect(sent.at(-1)!.subject).toBe("Your super1 PT sign-in link");
    expect(await readInvite(db, link)).toMatchObject({ hasAccount: true });
    await acceptInvite(db, link, { email: "pete@example.com", password: "new-password-9" });
    expect(await sessionSubject(db, "client", session)).toBeNull();
    expect(await clientLogin(db, "pete@example.com", "new-password-9")).toEqual({ memberId });

    const before = sent.length;
    await requestLoginHelp(db, mailer, "stranger@example.com", "https://super1.test");
    expect(sent.length).toBe(before);
  });

  it("archiving blocks sign-in; restoring brings them back as active", async () => {
    await setClientStatus(db, clientId, true);
    await expect(clientLogin(db, "pete@example.com", "new-password-9")).rejects.toThrow(/paused/);
    expect(await db.select().from(authSessions).where(eq(authSessions.subjectId, memberId))).toHaveLength(0);
    expect(await setClientStatus(db, clientId, false)).toBe("active");
  });
});

describe("linking", () => {
  it("is idempotent and moves a client to a new coach", async () => {
    const m = await createMember(db, { firstName: "Punpaporn", lastName: "Putla" });
    const first = await linkClient(db, { memberId: m.id, coachId: bella.id });
    const again = await linkClient(db, { memberId: m.id, coachId: aun.id });
    expect(first.created).toBe(true);
    expect(again).toMatchObject({ created: false, client: { id: first.client.id, coachId: aun.id, status: "invited" } });
  });

  it("without an email the invite is a link to share by LINE", async () => {
    const m = await createMember(db, { firstName: "Gaurav", lastName: "Chaudhary", phone: "0812345678" });
    const { client } = await linkClient(db, { memberId: m.id, coachId: bella.id });
    const before = sent.length;
    const res = await sendInvite(db, mailer, client.id, "https://super1.test");
    expect(res).toMatchObject({ emailed: false, email: null });
    expect(sent.length).toBe(before);
    const again = await sendInvite(db, mailer, client.id, "https://super1.test");
    expect(await readInvite(db, tokenFrom(res.link))).toBeNull(); // the newer link replaces it
    expect(await readInvite(db, tokenFrom(again.link))).toMatchObject({ firstName: "Gaurav" });
  });
});
