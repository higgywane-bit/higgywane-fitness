/*
 * Connecting a customer's app account (Google / Apple / email) to their member record.
 * No imports on purpose: the Supabase edge functions copy this file and run it in Deno,
 * so the app, the tests and the server all decide links the same way.
 *
 * Three ways in:
 *  1. Invite: staff add an email at the desk, we email a sign-in link. Signing in with
 *     that email links straight to the invited member.
 *  2. Email match: a new account whose verified email belongs to exactly one unlinked member.
 *  3. Request: anything else waits in the admin "App requests" queue, and the app shows a
 *     link QR the desk can scan to connect it in one tap.
 */

export type LinkAccount = {
  email: string | null;
  emailVerified: boolean;
  name?: string | null;
  phone?: string | null;
};

export type LinkMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  /** auth user already connected to this member */
  userId: string | null;
  archived: boolean;
};

export type LinkInvite = {
  memberId: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
};

export type MatchReason = "email" | "phone" | "name" | "first-name";

export type LinkSuggestion = { memberId: string; score: number; reasons: MatchReason[] };

export type LinkDecision =
  | { kind: "link"; memberId: string; via: "invite" | "email" }
  | { kind: "request"; reason: "unverified" | "no-match" | "several-matches" | "already-linked"; suggestions: LinkSuggestion[] };

export function normalizeEmail(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return e.includes("@") ? e : null;
}

/** Thai numbers written as 081…, +66 81…, 66-81… all compare on their last 9 digits. */
export function phoneKey(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : null;
}

const nameKey = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** Best guesses for the admin queue, strongest first. Linked and archived members are skipped. */
export function suggestMatches(account: LinkAccount, members: LinkMember[], limit = 5): LinkSuggestion[] {
  const email = normalizeEmail(account.email);
  const phone = phoneKey(account.phone);
  const full = nameKey(account.name);
  const first = nameKey((account.name ?? "").trim().split(/\s+/)[0]);
  const out: LinkSuggestion[] = [];
  for (const m of members) {
    if (m.userId || m.archived) continue;
    const hits: [MatchReason, number][] = [];
    if (email && normalizeEmail(m.email) === email) hits.push(["email", 100]);
    if (phone && phoneKey(m.phone) === phone) hits.push(["phone", 80]);
    if (full && nameKey(`${m.firstName}${m.lastName}`) === full) hits.push(["name", 60]);
    else if (first.length >= 3 && nameKey(m.firstName) === first) hits.push(["first-name", 20]);
    if (hits.length) out.push({ memberId: m.id, score: hits.reduce((a, [, n]) => a + n, 0), reasons: hits.map(([r]) => r) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** What happens when a signed-in customer has no member yet. Runs on the server only. */
export function decideLink(account: LinkAccount, data: { members: LinkMember[]; invites: LinkInvite[] }, now: Date = new Date()): LinkDecision {
  const suggestions = () => suggestMatches(account, data.members);
  const email = normalizeEmail(account.email);
  // An unverified email proves nothing: anyone can type someone else's address.
  if (!email || !account.emailVerified) return { kind: "request", reason: "unverified", suggestions: suggestions() };

  const byId = new Map(data.members.map((m) => [m.id, m]));
  const invite = data.invites
    .filter((i) => normalizeEmail(i.email) === email && !i.usedAt && new Date(i.expiresAt) > now)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .find((i) => byId.has(i.memberId));
  if (invite) {
    const m = byId.get(invite.memberId)!;
    if (!m.userId && !m.archived) return { kind: "link", memberId: m.id, via: "invite" };
  }

  const sameEmail = data.members.filter((m) => !m.archived && normalizeEmail(m.email) === email);
  const free = sameEmail.filter((m) => !m.userId);
  if (free.length === 1) return { kind: "link", memberId: free[0].id, via: "email" };
  // Families often share one email: let the desk pick who this is.
  if (free.length > 1) return { kind: "request", reason: "several-matches", suggestions: suggestions() };
  if (sameEmail.length) return { kind: "request", reason: "already-linked", suggestions: suggestions() };
  return { kind: "request", reason: "no-match", suggestions: suggestions() };
}

/* ── Desk link QR ─────────────────────────────────────────────
 * An unlinked account shows "SF-LINK-K7M2Q9PX" as a QR. The desk scanner types it into the
 * normal check-in box; the check-in screen spots the prefix and opens "Link to member".
 * Only letters, digits and dashes, so any USB scanner in keyboard mode types it correctly.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const LINK_TOKEN_TTL_MINUTES = 15;
const LINK_RE = /^SF-?LINK-?([0-9A-HJKMNP-TV-Z]{8})$/;

export function generateLinkToken(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % 32]).join("");
}

export function linkPayload(token: string): string {
  return `SF-LINK-${token}`;
}

export function isLinkTokenFresh(createdAt: string | Date, now: Date = new Date(), ttlMinutes = LINK_TOKEN_TTL_MINUTES): boolean {
  const age = now.getTime() - new Date(createdAt).getTime();
  return age >= 0 && age < ttlMinutes * 60_000;
}

/** Everything typed into the desk box: a member's code, or a customer asking to be linked. */
export type DeskScan = { kind: "link"; token: string } | { kind: "code"; raw: string };

export function parseDeskScan(raw: string): DeskScan {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  const m = LINK_RE.exec(s);
  return m ? { kind: "link", token: m[1] } : { kind: "code", raw: raw.trim() };
}
