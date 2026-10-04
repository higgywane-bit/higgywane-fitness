// Staff: "Invite to the app" from check-in or the member page.
// Saves the email on the member, records the invite, and emails a sign-in link.
// Opening the link signs them in; link-account then connects them to this member.
// Body: { memberId: string, email: string }
// Secrets: APP_URL (the customer app, e.g. https://superfit.app) for the link's landing page.
import { normalizeEmail } from "../_shared/link.ts";
import { adminClient, fullName, handle, HttpError, json, MEMBER_COLS, requireStaff, type MemberRow } from "../_shared/http.ts";

Deno.serve(
  handle(async (req) => {
    const { user: staff } = await requireStaff(req);
    const admin = adminClient();
    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Check the email address.");

    const { data: m } = await admin.from("members").select(MEMBER_COLS).eq("id", String(body.memberId ?? "")).maybeSingle<MemberRow>();
    if (!m || m.archived_at) throw new HttpError(404, "Member not found.");
    if (m.user_id) throw new HttpError(409, `${fullName(m)} already has the app.`);

    if (normalizeEmail(m.email) !== email) await admin.from("members").update({ email, updated_at: new Date().toISOString() }).eq("id", m.id);
    const { error } = await admin.from("member_invites").insert({ member_id: m.id, email, invited_by: staff.id });
    if (error) throw error;

    const redirectTo = `${Deno.env.get("APP_URL") ?? ""}/welcome`;
    const invited = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { full_name: fullName(m) } });
    if (invited.error) {
      // Already has an account (e.g. signed up with Google): send a normal sign-in link instead.
      const otp = await admin.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: false } });
      if (otp.error) throw new HttpError(502, `Couldn't send the email: ${otp.error.message}`);
    }

    await admin.from("activity").insert({ member_id: m.id, type: "app.invited", message: `Invited to the app: ${email}` });
    return json({ ok: true, email });
  }),
);
