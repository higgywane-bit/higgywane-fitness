import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getMailer } from "@/lib/email";
import { secretMatches } from "@/lib/api-auth";
import { sendReminders } from "@/lib/membership/reminder-service";

/*
 * Daily renewal reminders. Vercel Cron calls this (see vercel.json) with
 * "Authorization: Bearer $CRON_SECRET". Without a real mail provider it only logs.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? null;
  if (secret ? !secretMatches(bearer, secret) : process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const mailer = getMailer();
  const result = await sendReminders(await getDb(), mailer);
  return NextResponse.json({ mailer: mailer.name, ...result });
}
