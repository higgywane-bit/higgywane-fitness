"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CircleCheck } from "lucide-react";
import { saveFeedbackAction } from "@/app/app/actions";
import { Stepper, Switch, toast } from "@/components/pt/controls";
import { Button, Group, Row } from "@/components/pt/ui";
import { mediumDate } from "@/lib/pt/clients";
import { formatAnswer, type AnswerValue, type Answers, type Question } from "@/lib/pt/feedback";
import { cn } from "@/lib/utils";

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

export function FeedbackForm({
  date,
  today,
  prev,
  next,
  editable,
  questions,
  initial,
  completedAt,
}: {
  date: string;
  today: string;
  prev: string | null;
  next: string | null;
  editable: boolean;
  questions: Question[];
  initial: Answers;
  completedAt: string | null;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(initial);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(answers);

  // autosave a moment after each change, so nothing is lost if they close the app
  const set = (id: string, v: AnswerValue | undefined) => {
    const nextAnswers = { ...latest.current };
    if (v === undefined || v === "") delete nextAnswers[id];
    else nextAnswers[id] = v;
    latest.current = nextAnswers;
    setAnswers(nextAnswers);
    setSaved("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await saveFeedbackAction(date, latest.current, false);
      if (!res.ok) {
        setSaved("idle");
        return toast.bad("Not saved", res.error);
      }
      setSaved("saved");
    }, 700);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const missing = questions.filter((q) => answers[q.id] === undefined).length;
  const label = date === today ? "Today" : mediumDate(date).split(" ")[0];

  return (
    <>
      <div className="flex items-center justify-between rounded-[20px] bg-s1-surface-2 p-1.5">
        {prev ? (
          <Link href={`/app/feedback?date=${prev}`} aria-label="Previous day" className="tap grid size-11 place-items-center rounded-2xl hover:bg-s1-surface-3">
            <ChevronLeft className="size-5" />
          </Link>
        ) : (
          <span className="size-11" />
        )}
        <div className="text-center">
          <b className="block text-[17px]">{label}</b>
          <span className="text-[13px] text-s1-muted">{mediumDate(date).split(" ").slice(1).join(" ")}</span>
        </div>
        {next ? (
          <Link href={`/app/feedback?date=${next}`} aria-label="Next day" className="tap grid size-11 place-items-center rounded-2xl hover:bg-s1-surface-3">
            <ChevronRight className="size-5" />
          </Link>
        ) : (
          <span className="grid size-11 place-items-center text-s1-surface-4" aria-hidden>
            <ChevronRight className="size-5" />
          </span>
        )}
      </div>

      {completedAt ? (
        <div className="flex items-center gap-2.5 rounded-2xl bg-s1-green-tint px-4 py-3.5 text-[15px] font-semibold text-s1-green">
          <CircleCheck className="size-5" aria-hidden />
          Completed at {fmtTime(completedAt)}
        </div>
      ) : editable ? (
        <p className="mx-2 mb-1 flex items-center justify-between text-[14px] text-s1-faint">
          <span>Saved as you go. Tap Complete when you&apos;re done.</span>
          <span aria-live="polite" className={cn("text-[12px] font-semibold", saved === "saved" ? "text-s1-green" : "text-s1-faint")}>
            {saved === "saving" ? "Saving…" : saved === "saved" ? "Saved" : ""}
          </span>
        </p>
      ) : null}

      {editable ? (
        questions.map((q) => <QuestionCard key={q.id} q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />)
      ) : (
        <Group>
          {questions.map((q) => (
            <Row key={q.id} title={q.label} trail={<span className="num text-[17px] font-semibold">{formatAnswer(q, answers[q.id])}</span>} />
          ))}
        </Group>
      )}

      {editable && !completedAt ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black via-black/90 to-transparent px-4 pt-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto mx-auto max-w-md">
            <Button
              variant="primary"
              size="lg"
              block
              className="h-[58px] text-[18px]"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  if (timer.current) clearTimeout(timer.current);
                  const res = await saveFeedbackAction(date, latest.current, true);
                  if (!res.ok) return toast.bad("Not saved", res.error);
                  toast.good("Feedback sent", missing ? `${missing} left blank. Your coach can see the rest.` : "Your coach can see it now.");
                  router.push("/app");
                })
              }
            >
              {pending ? "Saving…" : "Complete"}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function QuestionCard({ q, value, onChange }: { q: Question; value: AnswerValue | undefined; onChange: (v: AnswerValue | undefined) => void }) {
  const id = `q-${q.id}`;
  const target = q.target != null ? (q.type === "number" ? `Target ${q.target.toLocaleString("en-US")}` : `Target ${q.target} ${q.unit ?? ""}`) : null;
  const inline = q.type === "stepper" || q.type === "yesno";
  return (
    <div className={cn("flex gap-3 rounded-[20px] bg-s1-surface-2 p-4", inline ? "items-center justify-between" : "flex-col")}>
      <div className="flex items-center justify-between gap-2">
        <h3 id={id} className="text-[17px] font-semibold">
          {q.label}
        </h3>
        {!inline ? <span className="text-[14px] text-s1-muted">{target ?? (q.type === "choice" ? "litres" : "")}</span> : null}
      </div>
      {q.type === "number" ? (
        <div className="relative">
          <input
            aria-labelledby={id}
            inputMode="decimal"
            value={value === undefined ? "" : String(value)}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d.]/g, "");
              onChange(raw === "" ? undefined : raw.endsWith(".") ? raw : Number(raw));
            }}
            className="num h-[52px] w-full rounded-full bg-s1-surface-3 pr-16 pl-5 text-[20px] font-semibold outline-none focus:ring-2 focus:ring-s1-blue/60"
          />
          <span className="pointer-events-none absolute top-1/2 right-5 -translate-y-1/2 text-[15px] font-medium text-s1-muted">{q.unit}</span>
        </div>
      ) : null}
      {q.type === "choice" ? (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${q.options?.length ?? 1}, minmax(0,1fr))` }} role="radiogroup" aria-labelledby={id}>
          {q.options?.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(value === o ? undefined : o)} className={cn("tap num h-12 rounded-full text-[16px] font-semibold", value === o ? "bg-s1-blue text-s1-on-blue" : "bg-s1-surface-3 hover:bg-s1-surface-4")}>
              {o}
            </button>
          ))}
        </div>
      ) : null}
      {q.type === "rate" ? (
        <>
          <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-labelledby={id}>
            {[1, 2, 3, 4, 5].map((o) => (
              <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(value === o ? undefined : o)} className={cn("tap num h-12 rounded-full text-[17px] font-semibold", value === o ? "bg-s1-blue text-s1-on-blue" : "bg-s1-surface-3 hover:bg-s1-surface-4")}>
                {o}
              </button>
            ))}
          </div>
          <div className="-mt-1 flex justify-between px-1.5 text-[12px] text-s1-faint">
            <span>Bad</span>
            <span>Great</span>
          </div>
        </>
      ) : null}
      {q.type === "stepper" ? (
        <Stepper
          label={q.label}
          value={typeof value === "number" ? value : 7}
          format={(n) => (typeof value === "number" ? `${n} ${q.unit ?? ""}`.trim() : "–")}
          onStep={(d) => {
            const base = typeof value === "number" ? value : 7;
            const n = typeof value === "number" ? Math.min(q.max ?? 24, Math.max(q.min ?? 0, base + d * (q.step ?? 1))) : base;
            onChange(n);
          }}
        />
      ) : null}
      {q.type === "yesno" ? <Switch checked={value === true} onChange={(v) => onChange(v)} label={q.label} /> : null}
      {q.type === "text" ? (
        <input aria-labelledby={id} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} maxLength={200} className="h-12 w-full rounded-2xl bg-s1-surface-3 px-4 text-[16px] outline-none focus:ring-2 focus:ring-s1-blue/60" />
      ) : null}
    </div>
  );
}
