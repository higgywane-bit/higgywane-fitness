/*
 * Stop-gap protection for /admin until staff logins exist: one shared passcode
 * (ADMIN_PASSCODE). Unset = admin is open, which is fine on a laptop but not online.
 */
export const ADMIN_COOKIE = "sf_admin";

export async function passcodeToken(passcode: string): Promise<string> {
  const data = new TextEncoder().encode(`superfit-admin:${passcode}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
