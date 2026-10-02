"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, passcodeToken } from "@/lib/admin-gate";

export async function loginAction(_: string | null, form: FormData): Promise<string | null> {
  const passcode = process.env.ADMIN_PASSCODE;
  const given = String(form.get("passcode") ?? "");
  const next = String(form.get("next") ?? "/admin");
  if (!passcode) redirect("/admin");
  // small fixed delay blunts guessing
  await new Promise((r) => setTimeout(r, 400));
  if (given !== passcode) return "That passcode isn't right.";
  (await cookies()).set(ADMIN_COOKIE, await passcodeToken(passcode), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
  redirect(next.startsWith("/admin") ? next : "/admin");
}
