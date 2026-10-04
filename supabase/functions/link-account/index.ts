// Called by the customer app after every sign-in until the account is linked.
// Links by invite or verified email; otherwise files/refreshes an App request with a desk link QR.
// Body (optional): { name?: string, phone?: string }
import { decideLink, generateLinkToken, isLinkTokenFresh, type LinkInvite } from "../_shared/link.ts";
import { adminClient, caller, connect, handle, json, MEMBER_COLS, toLinkMember, type MemberRow } from "../_shared/http.ts";

Deno.serve(
  handle(async (req) => {
    const { user } = await caller(req);
    const admin = adminClient();
    const body = await req.json().catch(() => ({}));

    const { data: mine } = await admin.from("members").select("id").eq("user_id", user.id).maybeSingle();
    if (mine) return json({ status: "linked", memberId: mine.id });

    const meta = user.user_metadata ?? {};
    const account = {
      email: user.email ?? null,
      // Google, Apple and email-link sign-ins all confirm the address. Keep "Confirm email" ON in Supabase.
      emailVerified: !!user.email_confirmed_at,
      name: String(body.name ?? meta.full_name ?? meta.name ?? "").slice(0, 80) || null,
      phone: String(body.phone ?? user.phone ?? "").slice(0, 30) || null,
    };

    // ~1–5k members: small enough to match in memory with the shared rules.
    const { data: rows, error } = await admin.from("members").select(MEMBER_COLS).is("archived_at", null).limit(20000);
    if (error) throw error;
    const members = (rows as MemberRow[]).map(toLinkMember);
    const { data: inviteRows } = account.email
      ? await admin.from("member_invites").select("member_id, email, created_at, expires_at, used_at").ilike("email", account.email).is("used_at", null)
      : { data: [] };
    const invites: LinkInvite[] = (inviteRows ?? []).map((i) => ({
      memberId: i.member_id,
      email: i.email,
      createdAt: i.created_at,
      expiresAt: i.expires_at,
      usedAt: i.used_at,
    }));

    const decision = decideLink(account, { members, invites });
    if (decision.kind === "link") {
      await connect(admin, decision.memberId, user.id, decision.via === "invite" ? "desk invite" : "matching email", {
        phone: account.phone,
        photo: meta.avatar_url ?? null,
      });
      return json({ status: "linked", memberId: decision.memberId, via: decision.via });
    }

    const { data: existing } = await admin.from("account_link_requests").select("desk_token, desk_token_at").eq("user_id", user.id).maybeSingle();
    const keep = existing?.desk_token && existing.desk_token_at && isLinkTokenFresh(existing.desk_token_at);
    const deskToken = keep ? existing!.desk_token : generateLinkToken();
    const deskTokenAt = keep ? existing!.desk_token_at : new Date().toISOString();
    const now = new Date().toISOString();
    const { error: upsertError } = await admin.from("account_link_requests").upsert(
      {
        user_id: user.id,
        email: account.email,
        email_verified: account.emailVerified,
        full_name: account.name,
        phone: account.phone,
        avatar_url: meta.avatar_url ?? null,
        reason: decision.reason,
        suggestions: decision.suggestions,
        desk_token: deskToken,
        desk_token_at: deskTokenAt,
        status: "pending",
        updated_at: now,
      },
      { onConflict: "user_id" },
    );
    if (upsertError) throw upsertError;
    return json({ status: "pending", reason: decision.reason, deskToken, deskTokenAt });
  }),
);
