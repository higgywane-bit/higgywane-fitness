"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { forgotAction, joinAction, loginAction } from "@/app/app/actions";
import { Field, inputCls } from "@/components/pt/controls";
import { Button } from "@/components/pt/ui";

function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={show ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} pr-12`} required />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute top-1/2 right-1.5 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-s1-muted hover:text-white">
        {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
}

function ErrorText({ children }: { children: string | null }) {
  return children ? (
    <p role="alert" className="rounded-xl bg-s1-red-tint px-4 py-3 text-[14px] font-medium text-s1-red">
      {children}
    </p>
  ) : null;
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "forgot" | "sent">("login");
  const [pending, start] = useTransition();

  if (mode === "sent") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[20px] bg-s1-surface-2 p-6 text-center">
        <MailCheck className="size-8 text-s1-blue" aria-hidden />
        <p className="text-[17px] font-semibold">Check your email</p>
        <p className="text-[15px] text-s1-muted">If {email} has an account, a link to choose a new password is on its way.</p>
        <Button variant="plain" onClick={() => setMode("login")}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          if (mode === "forgot") {
            const res = await forgotAction(email);
            if (!res.ok) return setError(res.error);
            return setMode("sent");
          }
          const res = await loginAction(email, password);
          if (!res.ok) return setError(res.error);
          router.replace("/app");
          router.refresh();
        });
      }}
    >
      <Field label="Email" htmlFor="email">
        <input id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} required />
      </Field>
      {mode === "login" ? (
        <Field label="Password" htmlFor="password">
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" />
        </Field>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <Button type="submit" variant="primary" size="lg" block disabled={pending}>
        {pending ? "One moment…" : mode === "login" ? "Sign in" : "Email me a link"}
      </Button>
      <Button variant="plain" onClick={() => { setError(null); setMode(mode === "login" ? "forgot" : "login"); }}>
        {mode === "login" ? "Forgot password?" : "Back to sign in"}
      </Button>
    </form>
  );
}

export function JoinForm({ token, email: initialEmail, hasAccount }: { token: string; email: string | null; hasAccount: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await joinAction(token, email, password);
          if (!res.ok) return setError(res.error);
          router.replace("/app?welcome=1");
          router.refresh();
        });
      }}
    >
      <Field label="Email" htmlFor="email" hint="You'll sign in with this.">
        <input id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} required />
      </Field>
      <Field label={hasAccount ? "New password" : "Choose a password"} htmlFor="password" hint="At least 8 characters, with some letters.">
        <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="new-password" />
      </Field>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" variant="primary" size="lg" block disabled={pending}>
        {pending ? "Setting up…" : hasAccount ? "Save and sign in" : "Create my account"}
      </Button>
    </form>
  );
}
