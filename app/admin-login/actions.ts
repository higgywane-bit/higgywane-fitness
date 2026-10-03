"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, SESSION_DAYS, adminAuthConfig, checkCredentials, createSession } from "@/lib/admin-auth";

export type LoginState = { error: string; email: string } | null;

export async function loginAction(_: LoginState, form: FormData): Promise<LoginState> {
  const cfg = adminAuthConfig();
  const next = String(form.get("next") ?? "/admin");
  const safeNext = next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
  if (!cfg) redirect(safeNext);
  // small fixed delay blunts guessing
  await new Promise((r) => setTimeout(r, 400));
  const email = String(form.get("email") ?? "");
  if (!checkCredentials(cfg, email, String(form.get("password") ?? ""))) {
    return { error: "Email or password isn't right.", email };
  }
  (await cookies()).set(ADMIN_SESSION_COOKIE, await createSession(cfg), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
  redirect(safeNext);
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete(ADMIN_SESSION_COOKIE);
  jar.delete("sf_staff");
  redirect("/admin-login");
}
