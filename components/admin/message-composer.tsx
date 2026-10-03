"use client";

import { useEffect, useState } from "react";
import { Send, Users } from "lucide-react";
import { previewAudienceAction, sendMessageAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { SEGMENTS, type SegmentId } from "@/lib/messages/segments";
import { ErrorText, Select, useAction } from "./kit";

const TEMPLATES = [
  {
    label: "Renewal nudge",
    audience: "expiring" as SegmentId,
    subject: "{firstName}, your Superfit plan ends soon",
    body: "Hi {firstName},\n\nYour {plan} has {daysLeft} days left. Renew at the front desk and your next plan starts the day after, so you don't lose a day.\n\nSee you on the floor.",
  },
  {
    label: "We miss you",
    audience: "lapsed-30" as SegmentId,
    subject: "We miss you at Superfit, {firstName}",
    body: "Hi {firstName},\n\nIt's been a little while. Come back this week and pick up where you left off: a day pass, a week, or a month to get the routine back.",
  },
  {
    label: "Check in on at-risk",
    audience: "at-risk" as SegmentId,
    subject: "Everything OK, {firstName}?",
    body: "Hi {firstName},\n\nWe haven't seen you in a couple of weeks. Need a new programme, or a session with one of our coaches to get going again? Just reply.",
  },
  {
    label: "Opening hours",
    audience: "active" as SegmentId,
    subject: "Superfit holiday opening hours",
    body: "Hi {firstName},\n\nA quick heads up on our hours over the holiday:\n\n[dates and hours]\n\nThanks, and train hard!",
  },
];

export function MessageComposer({ tags, live }: { tags: string[]; live: boolean }) {
  const [audience, setAudience] = useState<SegmentId>("active");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<{ count: number; sample: { name: string; email: string | null }[] } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { run, pending, error } = useAction();

  useEffect(() => {
    let stop = false;
    previewAudienceAction(audience).then((r) => !stop && r.ok && setPreview(r.data));
    return () => {
      stop = true;
    };
  }, [audience]);

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium text-text-secondary">Start from a template</p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => {
                setAudience(t.audience);
                setSubject(t.subject);
                setBody(t.body);
                setDone(null);
              }}
              className="tap glass h-10 rounded-full px-4 text-sm font-medium text-text-secondary hover:text-white"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label htmlFor="msg-aud">Send to</Label>
        <Select id="msg-aud" value={audience} onChange={(e) => setAudience(e.target.value as SegmentId)}>
          {SEGMENTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}: {s.description}
            </option>
          ))}
          {tags.map((t) => (
            <option key={t} value={`tag:${t}`}>
              Tagged “{t}”
            </option>
          ))}
        </Select>
        <p className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
          <Users className="size-4" aria-hidden />
          {preview ? `${preview.count} people with an email who allow messages` : "Counting…"}
          {preview?.sample.length ? <span className="truncate text-text-tertiary">· {preview.sample.map((s) => s.name).join(", ")}{preview.count > 5 ? "…" : ""}</span> : null}
        </p>
      </div>
      <div>
        <Label htmlFor="msg-sub">Subject</Label>
        <Input id="msg-sub" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="msg-body">Message</Label>
        <Textarea id="msg-body" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-48" />
        <p className="mt-2 text-xs text-text-tertiary">
          Personalise with <code className="rounded bg-surface-3 px-1">{"{firstName}"}</code> <code className="rounded bg-surface-3 px-1">{"{plan}"}</code> <code className="rounded bg-surface-3 px-1">{"{daysLeft}"}</code>
        </p>
      </div>
      <ErrorText error={error} />
      {done ? <p className="text-sm font-semibold text-success">{done}</p> : null}
      <Button
        size="lg"
        className="w-full md:w-auto"
        disabled={pending || !subject.trim() || !body.trim() || !preview?.count}
        onClick={() =>
          run(() => sendMessageAction({ audience, subject, body }), (d) => {
            const r = d as { sent: number; status: string };
            setDone(r.status === "sent" ? `Sent to ${r.sent} people.` : `Saved as a preview for ${r.sent} people. Connect email in Settings to send for real.`);
          })
        }
      >
        <Send className="size-4" aria-hidden />
        {pending ? "Sending…" : live ? `Send to ${preview?.count ?? 0}` : `Preview for ${preview?.count ?? 0} (email not connected)`}
      </Button>
    </div>
  );
}
