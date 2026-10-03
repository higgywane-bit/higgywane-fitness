import "server-only";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, adminAuthConfig, verifySession } from "@/lib/admin-auth";

export class NotSignedInError extends Error {}

/**
 * Server actions can be called from any route, so middleware alone doesn't guard them.
 * Every admin action checks the session itself.
 */
export async function requireAdmin() {
  const cfg = adminAuthConfig();
  if (!cfg) return;
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!(await verifySession(cfg, token))) throw new NotSignedInError("Signed out. Sign in again.");
}
