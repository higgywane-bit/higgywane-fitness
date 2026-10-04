import { describe, expect, it } from "vitest";
import {
  decideLink,
  generateLinkToken,
  isLinkTokenFresh,
  linkPayload,
  normalizeEmail,
  parseDeskScan,
  phoneKey,
  suggestMatches,
  type LinkInvite,
  type LinkMember,
} from "@/lib/customer/link";
import { customerMembershipView, formatPassCode, pickPassCode } from "@/lib/customer/pass";
import type { MembershipLike } from "@/lib/membership/access";

const member = (over: Partial<LinkMember>): LinkMember => ({
  id: Math.random().toString(36).slice(2),
  firstName: "Dale",
  lastName: "Egan",
  email: null,
  phone: null,
  userId: null,
  archived: false,
  ...over,
});

const now = new Date("2026-10-04T05:00:00Z");
const invite = (memberId: string, email: string, over: Partial<LinkInvite> = {}): LinkInvite => ({
  memberId,
  email,
  createdAt: "2026-10-03T10:00:00Z",
  expiresAt: "2026-10-17T10:00:00Z",
  usedAt: null,
  ...over,
});

describe("linking an app account to a member", () => {
  it("compares emails and Thai phone numbers loosely", () => {
    expect(normalizeEmail("  Dale@Mail.COM ")).toBe("dale@mail.com");
    expect(normalizeEmail("not an email")).toBeNull();
    expect(phoneKey("081-234-5678")).toBe(phoneKey("+66 81 234 5678"));
    expect(phoneKey("1234")).toBeNull();
  });

  it("links an invited email straight to the invited member", () => {
    const dale = member({ email: "old@mail.com" });
    const d = decideLink({ email: "Dale@new.com", emailVerified: true }, { members: [dale], invites: [invite(dale.id, "dale@new.com")] }, now);
    expect(d).toEqual({ kind: "link", memberId: dale.id, via: "invite" });
  });

  it("ignores used and expired invites", () => {
    const dale = member({});
    const data = (i: LinkInvite) => ({ members: [dale], invites: [i] });
    const acct = { email: "dale@new.com", emailVerified: true };
    expect(decideLink(acct, data(invite(dale.id, "dale@new.com", { usedAt: "2026-10-03T11:00:00Z" })), now).kind).toBe("request");
    expect(decideLink(acct, data(invite(dale.id, "dale@new.com", { expiresAt: "2026-10-04T04:00:00Z" })), now).kind).toBe("request");
  });

  it("links on a verified email that matches exactly one free member", () => {
    const dale = member({ email: "dale@mail.com" });
    const d = decideLink({ email: "DALE@mail.com", emailVerified: true }, { members: [dale, member({ email: "x@y.com" })], invites: [] }, now);
    expect(d).toEqual({ kind: "link", memberId: dale.id, via: "email" });
  });

  it("never links on an unverified email", () => {
    const dale = member({ email: "dale@mail.com" });
    const d = decideLink({ email: "dale@mail.com", emailVerified: false }, { members: [dale], invites: [] }, now);
    expect(d.kind).toBe("request");
    if (d.kind === "request") {
      expect(d.reason).toBe("unverified");
      expect(d.suggestions[0]).toMatchObject({ memberId: dale.id, reasons: ["email"] });
    }
  });

  it("asks the desk when a family shares one email, or the member is already linked", () => {
    const shared = [member({ email: "fam@mail.com" }), member({ firstName: "Anna", email: "fam@mail.com" })];
    const d1 = decideLink({ email: "fam@mail.com", emailVerified: true }, { members: shared, invites: [] }, now);
    expect(d1).toMatchObject({ kind: "request", reason: "several-matches" });
    const taken = member({ email: "dale@mail.com", userId: "user-1" });
    const d2 = decideLink({ email: "dale@mail.com", emailVerified: true }, { members: [taken], invites: [] }, now);
    expect(d2).toMatchObject({ kind: "request", reason: "already-linked", suggestions: [] });
  });

  it("does not link archived members", () => {
    const gone = member({ email: "dale@mail.com", archived: true });
    expect(decideLink({ email: "dale@mail.com", emailVerified: true }, { members: [gone], invites: [invite(gone.id, "dale@mail.com")] }, now).kind).toBe("request");
  });

  it("ranks suggestions for the admin queue: email, then phone, then name", () => {
    const byPhone = member({ firstName: "Sai", lastName: "Htet", phone: "0812345678" });
    const byName = member({ firstName: "Sai", lastName: "Htet" });
    const byFirst = member({ firstName: "Sai", lastName: "Other" });
    const unrelated = member({ firstName: "Polina", lastName: "Golub" });
    const s = suggestMatches({ email: "sai@mail.com", emailVerified: true, name: "Sai Htet", phone: "+66 81 234 5678" }, [unrelated, byFirst, byName, byPhone]);
    expect(s.map((x) => x.memberId)).toEqual([byPhone.id, byName.id, byFirst.id]);
    expect(s[0].reasons).toEqual(["phone", "name"]);
  });
});

describe("desk link QR", () => {
  it("round-trips through the check-in box and leaves member codes alone", () => {
    const token = generateLinkToken();
    expect(token).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(parseDeskScan(linkPayload(token))).toEqual({ kind: "link", token });
    expect(parseDeskScan(` sf-link-${token.toLowerCase()} `)).toEqual({ kind: "link", token });
    expect(parseDeskScan("482913")).toEqual({ kind: "code", raw: "482913" });
    expect(parseDeskScan("K7M2 Q9PX")).toEqual({ kind: "code", raw: "K7M2 Q9PX" });
  });

  it("expires after 15 minutes", () => {
    expect(isLinkTokenFresh("2026-10-04T04:50:00Z", now)).toBe(true);
    expect(isLinkTokenFresh("2026-10-04T04:44:59Z", now)).toBe(false);
    expect(isLinkTokenFresh("2026-10-04T05:01:00Z", now)).toBe(false);
  });
});

describe("digital pass", () => {
  it("shows the member's tag code first so phone and keyring work the same", () => {
    const creds = [
      { kind: "qr", code: "K7M2Q9PX", createdAt: "2026-10-01T00:00:00Z" },
      { kind: "card", code: "482913", createdAt: "2026-09-01T00:00:00Z" },
      { kind: "card", code: "111111", createdAt: "2026-10-02T00:00:00Z", revokedAt: "2026-10-03T00:00:00Z" },
    ];
    expect(pickPassCode(creds)).toEqual({ code: "482913", display: "482 913", kind: "card" });
    expect(pickPassCode(creds.filter((c) => c.kind === "qr"))).toEqual({ code: "K7M2Q9PX", display: "K7M2 Q9PX", kind: "qr" });
    expect(pickPassCode([])).toBeNull();
    expect(formatPassCode("0012345")).toBe("0012 345");
  });
});

describe("customer membership view", () => {
  const plan = (over: Partial<MembershipLike>): MembershipLike => ({
    id: Math.random().toString(36),
    kind: "membership",
    planName: "1 Month",
    startsOn: "2026-10-04",
    endsOn: "2026-11-03",
    ...over,
  });

  it("matches the desk: 30 days left on day one of a month", () => {
    const v = customerMembershipView([plan({})], "2026-10-04");
    expect(v).toMatchObject({ status: "active", badge: "Active", tone: "ok", canTrain: true, headline: "30 days left", coveredUntil: "2026-11-03", progress: 0 });
    expect(v.message).toContain("3 Nov");
  });

  it("warns when expiring and fills the ring as days pass", () => {
    const v = customerMembershipView([plan({})], "2026-10-30");
    expect(v).toMatchObject({ status: "expiring", tone: "warn", headline: "4 days left" });
    expect(v.progress).toBeGreaterThan(0.8);
    expect(v.message).toContain("Renew");
  });

  it("covers expired, paused, upcoming and no plan", () => {
    expect(customerMembershipView([plan({})], "2026-11-05")).toMatchObject({ status: "expired", tone: "deny", canTrain: false, headline: "Ended 3 Nov" });
    expect(customerMembershipView([plan({ frozenFrom: "2026-10-10", frozenUntil: "2026-10-20", endsOn: "2026-11-14" })], "2026-10-12")).toMatchObject({
      status: "frozen",
      badge: "Paused",
      headline: "Paused until 20 Oct",
    });
    expect(customerMembershipView([plan({ startsOn: "2026-10-12" })], "2026-10-04")).toMatchObject({ status: "upcoming", headline: "Starts 12 Oct" });
    expect(customerMembershipView([], "2026-10-04")).toMatchObject({ status: "none", canTrain: false, planName: null });
  });

  it("shows PT sessions left alongside the gym plan", () => {
    const v = customerMembershipView(
      [plan({}), plan({ kind: "pt", planName: "10 PT sessions", sessionsTotal: 10, sessionsUsed: 3, endsOn: "2027-01-04" })],
      "2026-10-04",
    );
    expect(v.pt).toEqual({ planName: "10 PT sessions", sessionsLeft: 7, sessionsTotal: 10, endsOn: "2027-01-04" });
  });
});
