import Link from "next/link";
import { Link2Off } from "lucide-react";
import { JoinForm } from "@/components/pt/client/auth-forms";
import { btn, Disc, Wordmark } from "@/components/pt/ui";
import { getDb } from "@/lib/db";
import { readInvite } from "@/lib/pt/service";

export const metadata = { title: "Set up your account" };
export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await readInvite(await getDb(), token);

  if (!invite) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <Disc tone="yellow" className="size-14 [&_svg]:size-7">
          <Link2Off />
        </Disc>
        <h1 className="text-[28px] font-bold tracking-tight">This link has expired</h1>
        <p className="max-w-xs text-[15px] text-s1-muted">Links work once and for 14 days. Ask your coach or the front desk to send a new one.</p>
        <Link href="/app/login" className={btn({ variant: "tinted", size: "lg", className: "mt-2" })}>
          I already have an account
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-8 px-5 py-10">
      <div className="flex flex-col gap-3 px-1">
        <Wordmark className="text-[30px]" />
        <h1 className="text-[34px] leading-10 font-bold tracking-[-0.022em]">{invite.hasAccount ? "New password" : `Hi ${invite.firstName}`}</h1>
        <p className="text-[15px] text-s1-muted">
          {invite.hasAccount
            ? "Choose a new password and you're back in."
            : `${invite.coachName} has set you up. Choose a password and your plan is on your phone.`}
        </p>
      </div>
      <JoinForm token={token} email={invite.email} hasAccount={invite.hasAccount} />
    </main>
  );
}
