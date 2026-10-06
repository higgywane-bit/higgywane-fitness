"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Copy, Smartphone } from "lucide-react";
import { sendPtInviteAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

/** On a member's profile: are they on the PT app, with which coach, and a way to resend their link. */
export function PtAppStatus({ memberId, status, coachName, hasEmail }: { memberId: string; status: "invited" | "active" | "archived" | null; coachName: string | null; hasEmail: boolean }) {
  const [link, setLink] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  if (!status) {
    return <p className="mt-4 border-t border-hairline pt-4 text-xs text-text-tertiary">Not on the PT app. Sell a PT pack and pick a coach to link them and send their invite.</p>;
  }
  const label = status === "active" ? "On the PT app" : status === "invited" ? "Invited to the PT app, not joined yet" : "Removed from the PT app";
  return (
    <div className="mt-4 space-y-3 border-t border-hairline pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <Smartphone className="size-4 text-text-secondary" aria-hidden />
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">{label}</span>
          {coachName ? <span className="text-text-secondary"> · coach {coachName}</span> : null}
        </p>
        {status !== "archived" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await sendPtInviteAction(memberId);
                if (!res.ok) return setNote(res.error);
                setLink(res.data.link);
                setNote(res.data.emailed ? (res.data.preview ? `Logged for ${res.data.email} (email not connected yet). Share the link:` : `Emailed to ${res.data.email}. Or share the link:`) : "Share this link by LINE or SMS:");
              })
            }
          >
            {status === "active" ? "Send password link" : hasEmail ? "Resend invite" : "Get invite link"}
          </Button>
        ) : null}
      </div>
      {note ? <p className="text-xs text-text-secondary">{note}</p> : null}
      {link ? (
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-black/40 px-3 py-2 text-xs text-text-secondary">{link}</code>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(link).catch(() => {});
              setCopied(true);
            }}
          >
            <Copy className="size-4" aria-hidden /> {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      ) : null}
      <Link href="/coach" className="inline-block text-xs text-text-tertiary underline-offset-4 hover:underline">
        Open the coach portal
      </Link>
    </div>
  );
}
