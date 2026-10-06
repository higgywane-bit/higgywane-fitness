import { redirect } from "next/navigation";
import { LoginForm } from "@/components/pt/client/auth-forms";
import { Wordmark } from "@/components/pt/ui";
import { currentClient } from "@/lib/pt/session";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await currentClient()) redirect("/app");
  return (
    <main className="flex min-h-dvh flex-col justify-center gap-8 px-5 py-10">
      <div className="flex flex-col gap-3 px-1">
        <Wordmark className="text-[30px]" />
        <h1 className="text-[34px] leading-10 font-bold tracking-[-0.022em]">Sign in</h1>
        <p className="text-[15px] text-s1-muted">Your workouts, nutrition and daily check-ins from your coach.</p>
      </div>
      <LoginForm />
      <p className="px-1 text-center text-[14px] text-s1-faint">New here? Use the link your coach sent you to set up your account.</p>
    </main>
  );
}
