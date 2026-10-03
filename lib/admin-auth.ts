/*
 * Admin sign-in: one Superfit account (ADMIN_EMAIL + ADMIN_PASSWORD). Staff on a
 * shared device then pick "who's working" with their PIN for the activity log.
 *
 * The session cookie is "<email>.<expires>.<hmac>", signed with AUTH_SECRET
 * (or the password when AUTH_SECRET is unset, so changing the password signs
 * everyone out). Web Crypto only: runs in middleware and in server actions.
 */
export const ADMIN_SESSION_COOKIE = "sf_session";
export const SESSION_DAYS = 30;

export type AdminAuthConfig = { email: string; password: string; secret: string };

export function adminAuthConfig(env: Record<string, string | undefined> = process.env): AdminAuthConfig | null {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD;
  if (!email || !password) return null;
  return { email, password, secret: env.AUTH_SECRET || `superfit:${password}` };
}

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

/** Compares without leaking where the strings differ. */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function createSession(cfg: AdminAuthConfig, now = Date.now()): Promise<string> {
  const payload = `${b64url(enc.encode(cfg.email))}.${now + SESSION_DAYS * 86_400_000}`;
  return `${payload}.${await hmac(cfg.secret, payload)}`;
}

export async function verifySession(cfg: AdminAuthConfig, token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [email, expires, sig] = parts;
  if (!/^\d+$/.test(expires) || Number(expires) < now) return false;
  if (!safeEqual(email, b64url(enc.encode(cfg.email)))) return false;
  return safeEqual(sig, await hmac(cfg.secret, `${email}.${expires}`));
}

export function checkCredentials(cfg: AdminAuthConfig, email: string, password: string): boolean {
  // evaluate both so a wrong email takes as long as a wrong password
  const okEmail = safeEqual(email.trim().toLowerCase(), cfg.email);
  const okPassword = safeEqual(password, cfg.password);
  return okEmail && okPassword;
}
