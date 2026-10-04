import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

/** Service-role client: bypasses RLS, so every handler checks who's asking first. */
export const adminClient = (): SupabaseClient =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

export async function caller(req: Request): Promise<{ user: User; userClient: SupabaseClient }> {
  const authorization = req.headers.get("Authorization");
  if (!authorization) throw new HttpError(401, "Sign in first.");
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Sign in first.");
  return { user: data.user, userClient };
}

export async function requireStaff(req: Request) {
  const c = await caller(req);
  const { data, error } = await c.userClient.rpc("is_staff");
  if (error || data !== true) throw new HttpError(403, "Staff only.");
  return c;
}

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST") return json({ error: "POST only." }, 405);
    try {
      return await fn(req);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: "Something went wrong. Try again." }, 500);
    }
  };
}

export const fullName = (m: { first_name: string; last_name: string }) => `${m.first_name} ${m.last_name}`.trim();

/** Random URL-safe secret, same shape as lib/membership/codes.ts generatePassToken(). */
export function passToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type MemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  user_id: string | null;
  archived_at: string | null;
};

export const MEMBER_COLS = "id, first_name, last_name, email, phone, photo_url, user_id, archived_at";

export const toLinkMember = (m: MemberRow) => ({
  id: m.id,
  firstName: m.first_name,
  lastName: m.last_name,
  email: m.email,
  phone: m.phone,
  userId: m.user_id,
  archived: !!m.archived_at,
});

/** Connect an auth user to a member. Fails safely if either side got linked meanwhile. */
export async function connect(admin: SupabaseClient, memberId: string, userId: string, how: string, fill: { email?: string | null; phone?: string | null; photo?: string | null } = {}) {
  const { data: other } = await admin.from("members").select("id").eq("user_id", userId).maybeSingle();
  if (other) throw new HttpError(409, "That app account is already linked to a member.");
  const { data: m } = await admin.from("members").select(MEMBER_COLS).eq("id", memberId).maybeSingle<MemberRow>();
  if (!m || m.archived_at) throw new HttpError(404, "Member not found.");
  if (m.user_id) throw new HttpError(409, `${fullName(m)} already has the app linked.`);

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { user_id: userId, app_linked_at: now, updated_at: now };
  if (!m.email && fill.email) patch.email = fill.email;
  if (!m.phone && fill.phone) patch.phone = fill.phone;
  if (!m.photo_url && fill.photo) patch.photo_url = fill.photo;
  const { data: done, error } = await admin.from("members").update(patch).eq("id", memberId).is("user_id", null).select("id");
  if (error || !done?.length) throw new HttpError(409, "Someone linked this member a moment ago. Refresh and try again.");

  await admin
    .from("account_link_requests")
    .update({ status: "linked", member_id: memberId, resolved_at: now, desk_token: null, updated_at: now })
    .eq("user_id", userId);
  await admin.from("member_invites").update({ used_at: now }).eq("member_id", memberId).is("used_at", null);
  await admin.from("activity").insert({ member_id: memberId, type: "app.linked", message: `App account linked (${how})` });
  return m;
}
