// Staff: connect app accounts to members at the desk and from the App requests queue.
// Body, one of:
//   { action: "peek",    token }                 → who is this? (after scanning SF-LINK-… at check-in)
//   { action: "link",    token | requestId, memberId }
//   { action: "create",  token | requestId }     → new member from the account's name/email/phone, linked
//   { action: "dismiss", requestId }
//   { action: "unlink",  memberId }              → e.g. linked to the wrong person
import { generateLinkToken, isLinkTokenFresh } from "../_shared/link.ts";
import { adminClient, connect, fullName, handle, HttpError, json, passToken, requireStaff } from "../_shared/http.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

type Request_ = {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  desk_token: string | null;
  desk_token_at: string | null;
  status: string;
  suggestions: unknown;
};

async function findRequest(admin: SupabaseClient, body: { token?: string; requestId?: string }): Promise<Request_> {
  const q = admin.from("account_link_requests").select("*");
  const { data } = body.token
    ? await q.eq("desk_token", String(body.token).toUpperCase()).maybeSingle<Request_>()
    : await q.eq("id", String(body.requestId ?? "")).maybeSingle<Request_>();
  if (!data) throw new HttpError(404, "That link code isn't recognised. Ask them to reopen the app.");
  if (body.token && !(data.desk_token_at && isLinkTokenFresh(data.desk_token_at))) {
    throw new HttpError(410, "That link code expired. Ask them to reopen the app for a fresh one.");
  }
  if (data.status === "linked") throw new HttpError(409, "That app account is already linked.");
  return data;
}

Deno.serve(
  handle(async (req) => {
    const { user: staff } = await requireStaff(req);
    const admin = adminClient();
    const body = await req.json().catch(() => ({}));
    const now = new Date().toISOString();

    switch (body.action) {
      case "peek": {
        const r = await findRequest(admin, body);
        return json({ requestId: r.id, name: r.full_name, email: r.email, phone: r.phone, avatarUrl: r.avatar_url, suggestions: r.suggestions });
      }

      case "link": {
        const r = await findRequest(admin, body);
        const m = await connect(admin, String(body.memberId ?? ""), r.user_id, body.token ? "scanned at the desk" : "approved in admin", {
          email: r.email,
          phone: r.phone,
          photo: r.avatar_url,
        });
        await admin.from("account_link_requests").update({ resolved_by: staff.id }).eq("id", r.id);
        return json({ ok: true, memberId: m.id, name: fullName(m) });
      }

      case "create": {
        const r = await findRequest(admin, body);
        const [first, ...rest] = (r.full_name ?? r.email?.split("@")[0] ?? "New member").trim().split(/\s+/);
        const { data: m, error } = await admin
          .from("members")
          .insert({ first_name: first, last_name: rest.join(" "), email: r.email, phone: r.phone, photo_url: r.avatar_url, source: "app", pass_token: passToken() })
          .select("id, first_name, last_name")
          .single();
        if (error) throw error;
        // Every member gets a code for their pass; a tag can be linked later at the desk.
        for (let i = 0; i < 5; i++) {
          const { error: e } = await admin.from("credentials").insert({ member_id: m.id, kind: "qr", code: generateLinkToken() });
          if (!e) break;
        }
        await admin.from("activity").insert({ member_id: m.id, type: "member.created", message: "Member created from an app sign-up" });
        await connect(admin, m.id, r.user_id, "new member from app sign-up");
        await admin.from("account_link_requests").update({ resolved_by: staff.id }).eq("id", r.id);
        return json({ ok: true, memberId: m.id, name: fullName(m) });
      }

      case "dismiss": {
        const { error } = await admin
          .from("account_link_requests")
          .update({ status: "dismissed", resolved_at: now, resolved_by: staff.id, desk_token: null, updated_at: now })
          .eq("id", String(body.requestId ?? ""))
          .eq("status", "pending");
        if (error) throw error;
        return json({ ok: true });
      }

      case "unlink": {
        const { data: m } = await admin.from("members").select("id, first_name, last_name, user_id").eq("id", String(body.memberId ?? "")).maybeSingle();
        if (!m?.user_id) throw new HttpError(404, "That member has no app account linked.");
        await admin.from("members").update({ user_id: null, app_linked_at: null, updated_at: now }).eq("id", m.id);
        await admin.from("account_link_requests").update({ status: "pending", member_id: null, resolved_at: null, updated_at: now }).eq("user_id", m.user_id);
        await admin.from("activity").insert({ member_id: m.id, type: "app.unlinked", message: "App account unlinked at the desk" });
        return json({ ok: true });
      }

      default:
        throw new HttpError(400, "Unknown action.");
    }
  }),
);
