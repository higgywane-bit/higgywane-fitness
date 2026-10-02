"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { loginAction } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <Label htmlFor="passcode">Passcode</Label>
        <Input id="passcode" name="passcode" type="password" autoComplete="current-password" autoFocus required aria-invalid={!!error} />
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-red-text">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Checking…" : "Open admin"}
      </Button>
    </form>
  );
}
