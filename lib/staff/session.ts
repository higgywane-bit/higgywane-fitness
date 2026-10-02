import "server-only";
import { cookies } from "next/headers";

/*
 * "Who's working" on this device: the staff member chosen in the admin header.
 * Not a login (that comes with Supabase Auth); it labels who did what.
 */
const COOKIE = "sf_staff";

export async function actingStaffId(): Promise<string | null> {
  try {
    const v = (await cookies()).get(COOKIE)?.value;
    return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
  } catch {
    return null; // outside a request (tests, cron)
  }
}

export async function setActingStaff(id: string | null) {
  const jar = await cookies();
  if (!id) jar.delete(COOKIE);
  else jar.set(COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 16 });
}
