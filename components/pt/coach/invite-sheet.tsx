"use client";

import { useState, useTransition } from "react";
import { Copy, Link2, Mail, MessageCircle } from "lucide-react";
import { sendInviteAction } from "@/app/coach/actions";
import { Sheet, toast, useCopy } from "@/components/pt/controls";
import { Button, btn } from "@/components/pt/ui";

export type InviteResult = { link: string; emailed: boolean; email: string | null; preview: boolean };

/** Shows the result of an invite: emailed or not, and the link to copy or share by LINE. */
export function InviteResultView({ name, result }: { name: string; result: InviteResult }) {
  const { copied, copy } = useCopy();
  const text = `Hi ${name.split(" ")[0]}, here's your link to set up the super1 PT app: ${result.link}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-s1-surface-2 p-4 text-[15px] leading-[21px]">
        {result.emailed ? (
          <p>
            <b className="text-s1-green">Emailed to {result.email}.</b> {result.preview ? "Email isn't connected yet, so it was only logged. Share the link below instead." : "You can also share the link below."}
          </p>
        ) : (
          <p>No email on file. Share this link by LINE or SMS. It works once, for 14 days.</p>
        )}
      </div>
      <div className="flex items-center gap-2 rounded-2xl bg-s1-surface-2 py-2 pr-2 pl-4">
        <Link2 className="size-4 shrink-0 text-s1-muted" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[14px] text-s1-muted select-all">{result.link}</span>
        <Button size="sm" variant="tinted" onClick={() => copy(result.link)}>
          <Copy className="size-4" aria-hidden /> {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a href={`https://line.me/R/share?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className={btn({ variant: "secondary", size: "lg", className: "rounded-2xl" })}>
          <MessageCircle className="size-5 text-s1-green" aria-hidden /> LINE
        </a>
        <a href={`sms:?&body=${encodeURIComponent(text)}`} className={btn({ variant: "secondary", size: "lg", className: "rounded-2xl" })}>
          <Mail className="size-5" aria-hidden /> SMS
        </a>
      </div>
    </div>
  );
}

export function InviteButton({ clientId, name, hasEmail, label = "Send app invite", variant = "primary" }: { clientId: string; name: string; hasEmail: boolean; label?: string; variant?: "primary" | "tinted" | "secondary" }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [pending, start] = useTransition();
  const send = (channel: "email" | "link") =>
    start(async () => {
      const res = await sendInviteAction(clientId, channel);
      if (!res.ok) return toast.bad(res.error);
      setResult(res.data);
      if (res.data.emailed && !res.data.preview) toast.good("Invite sent", `Emailed to ${res.data.email}`);
    });
  return (
    <>
      <Button variant={variant} size="lg" block className="rounded-full" onClick={() => { setResult(null); setOpen(true); }}>
        {label}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title="App invite" description={`${name} signs in once and sees the plan you build.`}>
        {result ? (
          <InviteResultView name={name} result={result} />
        ) : (
          <div className="flex flex-col gap-2.5">
            {hasEmail ? (
              <Button variant="primary" size="lg" block disabled={pending} onClick={() => send("email")}>
                <Mail className="size-5" aria-hidden /> {pending ? "Sending…" : "Email the invite"}
              </Button>
            ) : null}
            <Button variant={hasEmail ? "secondary" : "primary"} size="lg" block disabled={pending} onClick={() => send("link")}>
              <Link2 className="size-5" aria-hidden /> Get a link for LINE or SMS
            </Button>
            <p className="px-2 pt-1 text-center text-[13px] text-s1-faint">A new link replaces any link sent before.</p>
          </div>
        )}
      </Sheet>
    </>
  );
}
