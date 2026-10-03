"use client";

import { Check, ChevronLeft, Loader2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState, useTransition } from "react";
import { requestBooking, sendCoachMessage, type BookingRequest } from "@/app/(site)/coaches/actions";
import { specialties } from "@/lib/catalog";
import type { Coach } from "@/content/types";
import { SelectGlow } from "@/components/motion/select-glow";
import { CheckIndicator } from "@/components/ui/check-indicator";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Input, Label, Textarea } from "@/components/ui/input";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { bookableDays, nowTime, openSlots, todayISO } from "@/lib/booking";
import { formatTHB } from "@/lib/format";
import { haptic } from "@/lib/fly-store";
import { ptPackages } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export type SheetMode = "book" | "message";
export type SheetState = { mode: SheetMode; packageId?: string } | null;

const GOALS = ["Build muscle", "Lose fat", "Comp prep", "Get stronger", "Not sure yet"];
const STEPS = ["Package", "Time", "Details"] as const;

function prettyDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function choiceClass(on: boolean, extra?: string) {
  return cn("tap relative isolate overflow-hidden text-left", on ? "glass-lit" : "glass hover:bg-white/[0.08]", extra);
}

export function BookingSheet({
  coach,
  state,
  onClose,
}: {
  coach: Coach;
  state: SheetState;
  onClose: () => void;
}) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const open = state !== null;
  const title = state?.mode === "message" ? `Message ${coach.name}` : `Book with ${coach.name}`;
  // Remount the flow each time the sheet opens so it starts fresh.
  const body = state ? <Flow key={`${state.mode}-${state.packageId}`} coach={coach} state={state} onClose={onClose} /> : null;
  const description =
    state?.mode === "message" ? `Send ${coach.name} a message` : `Choose a package, a time and send a booking request to ${coach.name}`;

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="flex h-[min(88dvh,760px)] w-[min(92vw,520px)] flex-col">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">{description}</DialogDescription>
          {body}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} repositionInputs={false}>
      <DrawerContent className="h-[92dvh]">
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        <DrawerDescription className="sr-only">{description}</DrawerDescription>
        {body}
      </DrawerContent>
    </Drawer>
  );
}

function Flow({ coach, state, onClose }: { coach: Coach; state: NonNullable<SheetState>; onClose: () => void }) {
  const reduce = useReducedMotion();
  const packages = useMemo(() => ptPackages(), []);
  const [clock] = useState(() => ({ today: todayISO(), now: nowTime() }));
  const days = useMemo(
    () => bookableDays(coach, clock.today).map((d) => ({ ...d, enabled: d.enabled && openSlots(coach, d.iso, clock.today, clock.now).length > 0 })),
    [coach, clock],
  );
  const isMessage = state.mode === "message";

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [packageId, setPackageId] = useState(state.packageId ?? packages[0].id);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [goal, setGoal] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<BookingRequest | "message" | null>(null);
  const [pending, start] = useTransition();

  const pkg = packages.find((p) => p.id === packageId)!;
  const personValid = name.trim().length > 0 && contact.trim().length >= 4;
  const canContinue = isMessage
    ? personValid && message.trim().length >= 2
    : step === 0
      ? Boolean(pkg)
      : step === 1
        ? Boolean(date && time)
        : personValid;

  const go = (to: number) => {
    setDir(to > step ? 1 : -1);
    setStep(to);
    setError(null);
  };

  const submit = () => {
    setError(null);
    start(async () => {
      if (isMessage) {
        const res = await sendCoachMessage({ coach: coach.slug, name, contact, message });
        if (!res.ok) return setError(res.error);
        haptic(18);
        setDone("message");
        return;
      }
      const res = await requestBooking({
        coach: coach.slug,
        packageId,
        date: date!,
        time: time!,
        name,
        contact,
        goal: goal ?? undefined,
        note,
      });
      if (!res.ok) return setError(res.error);
      haptic(18);
      setDone(res.data);
    });
  };

  const next = () => {
    if (!canContinue) return;
    if (isMessage || step === STEPS.length - 1) submit();
    else go(step + 1);
  };

  const slide = {
    initial: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * 40 }),
    animate: { opacity: 1, x: 0 },
    exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * -40 }),
  };

  if (done) {
    return (
      <Done
        coach={coach}
        result={done}
        onClose={onClose}
        summary={done === "message" ? null : `${pkg.name} · ${prettyDate(done.date)} · ${done.time}`}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* header */}
      <div className="flex items-center gap-3 px-4 pt-2 pb-3 md:px-6 md:pt-5">
        {!isMessage && step > 0 ? (
          <button type="button" onClick={() => go(step - 1)} aria-label="Back" className="tap glass grid size-11 shrink-0 place-items-center rounded-full">
            <ChevronLeft className="size-5" />
          </button>
        ) : (
          <span aria-hidden className="glass text-statement grid size-11 shrink-0 place-items-center rounded-full text-xl">
            {coach.name[0]}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[17px] leading-tight font-semibold">{isMessage ? `Message ${coach.name}` : `Book with ${coach.name}`}</p>
          <p className="text-xs text-text-tertiary">
            {isMessage ? "Ask anything before you commit" : `Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="tap glass grid size-11 shrink-0 place-items-center rounded-full">
          <X className="size-5" />
        </button>
      </div>
      {!isMessage ? (
        <div className="mx-4 flex gap-1.5 md:mx-6" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <motion.span
                className="block h-full rounded-full bg-white"
                initial={false}
                animate={{ width: i <= step ? "100%" : "0%" }}
                transition={{ duration: reduce ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
              />
            </span>
          ))}
        </div>
      ) : null}

      {/* body */}
      <div className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={isMessage ? "message" : step}
            custom={dir}
            variants={slide}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6 px-4 pt-5 pb-8 md:px-6"
          >
            {isMessage ? (
              <>
                <section>
                  <h3 className="mb-3 text-[17px] font-semibold">Start with</h3>
                  <div className="flex flex-wrap gap-2">
                    {[...coach.specialties.slice(0, 3).map((s) => `I'm interested in ${specialties[s].label.toLowerCase()}`), "What do sessions cost?"].map(
                      (q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setMessage(q)}
                          className={choiceClass(message === q, "rounded-full px-4 py-2.5 text-sm font-medium")}
                        >
                          <SelectGlow on={message === q} />
                          {q}
                        </button>
                      ),
                    )}
                  </div>
                </section>
                <section>
                  <Label htmlFor="msg">Message</Label>
                  <Textarea id="msg" value={message} maxLength={500} rows={4} onChange={(e) => setMessage(e.target.value)} placeholder={`Hi ${coach.name}, …`} />
                </section>
                <PersonFields name={name} setName={setName} contact={contact} setContact={setContact} />
              </>
            ) : step === 0 ? (
              <section>
                <h3 id="pkg-h" className="mb-3 text-[17px] font-semibold">
                  Choose a package
                </h3>
                <div role="radiogroup" aria-labelledby="pkg-h" className="space-y-2">
                  {packages.map((p) => {
                    const on = p.id === packageId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setPackageId(p.id)}
                        className={choiceClass(on, "flex min-h-[72px] w-full items-center gap-4 rounded-2xl px-4 py-3")}
                      >
                        <SelectGlow on={on} />
                        <span className="font-display tabular w-10 text-center text-[34px]">{p.sessions}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold">{p.sessions === 1 ? "Single session" : `${p.sessions} sessions`}</span>
                          <span className="tabular block text-xs text-text-tertiary">{formatTHB(p.perSession)} per session</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="tabular block text-[15px] font-semibold">{formatTHB(p.price)}</span>
                          {p.saving ? <span className="tabular block text-xs text-red-text">Save {formatTHB(p.saving)}</span> : null}
                        </span>
                        <CheckIndicator on={on} className="size-6" />
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : step === 1 ? (
              <>
                <section>
                  <h3 id="day-h" className="mb-3 text-[17px] font-semibold">
                    Pick a day
                  </h3>
                  <div role="radiogroup" aria-labelledby="day-h" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6">
                    {days.map((d) => {
                      const on = d.iso === date;
                      return (
                        <button
                          key={d.iso}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          disabled={!d.enabled}
                          aria-label={`${prettyDate(d.iso)}${d.enabled ? "" : ", unavailable"}`}
                          onClick={() => setDate(d.iso)}
                          className={choiceClass(on, "flex h-[76px] w-[60px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl disabled:pointer-events-none disabled:opacity-30")}
                        >
                          <SelectGlow on={on} />
                          <span className={cn("text-[11px] font-semibold uppercase", on ? "text-white/80" : "text-text-tertiary")}>{d.label}</span>
                          <span className="tabular text-xl font-bold">{d.day}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
                <section>
                  <div className="mb-3 flex items-baseline justify-between">
                    <h3 id="time-h" className="text-[17px] font-semibold">
                      Pick a time
                    </h3>
                    <span className="text-xs text-text-tertiary">Bangkok time</span>
                  </div>
                  {date ? (
                    <div role="radiogroup" aria-labelledby="time-h" className="grid grid-cols-3 gap-2">
                      {openSlots(coach, date, clock.today, clock.now).map((t) => {
                        const on = t === time;
                        return (
                          <button
                            key={t}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => setTime(t)}
                            className={choiceClass(on, "tabular flex h-12 items-center justify-center rounded-full text-[15px] font-semibold")}
                          >
                            <SelectGlow on={on} />
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="glass rounded-2xl px-4 py-5 text-center text-sm text-text-secondary">Choose a day to see {coach.name}&apos;s times.</p>
                  )}
                </section>
              </>
            ) : (
              <>
                <PersonFields name={name} setName={setName} contact={contact} setContact={setContact} />
                <section>
                  <h3 id="goal-h" className="mb-3 text-sm font-medium text-text-secondary">
                    Main goal
                  </h3>
                  <div role="radiogroup" aria-labelledby="goal-h" className="flex flex-wrap gap-2">
                    {GOALS.map((g) => {
                      const on = goal === g;
                      return (
                        <button
                          key={g}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => setGoal(on ? null : g)}
                          className={choiceClass(on, "h-11 rounded-full px-4 text-sm font-medium")}
                        >
                          <SelectGlow on={on} />
                          {g}
                        </button>
                      );
                    })}
                  </div>
                </section>
                <section>
                  <Label htmlFor="bk-note">Anything {coach.name} should know?</Label>
                  <Textarea id="bk-note" value={note} maxLength={300} rows={2} onChange={(e) => setNote(e.target.value)} placeholder="Injuries, experience, competition date" />
                </section>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* footer */}
      <div className="pb-safe border-t border-hairline bg-surface-1/80 px-4 pt-3 backdrop-blur-2xl md:px-6">
        {!isMessage ? (
          <p className="tabular mb-2 truncate text-center text-xs text-text-secondary">
            {[pkg.name, date ? prettyDate(date) : null, time].filter(Boolean).join(" · ")} · {formatTHB(pkg.price)}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mb-2 text-center text-sm text-red-text">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={next}
          disabled={!canContinue || pending}
          className="tap mb-3 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-red text-base font-semibold text-white hover:bg-red-hover active:bg-red-press disabled:bg-surface-3 disabled:text-text-tertiary"
        >
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          {isMessage ? "Send message" : step === STEPS.length - 1 ? "Send booking request" : "Continue"}
        </button>
      </div>
    </div>
  );
}

function PersonFields({
  name,
  setName,
  contact,
  setContact,
}: {
  name: string;
  setName: (v: string) => void;
  contact: string;
  setContact: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="bk-name">Your name</Label>
        <Input id="bk-name" value={name} autoComplete="name" maxLength={60} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="bk-contact">Phone or LINE ID</Label>
        <Input id="bk-contact" value={contact} autoComplete="tel" maxLength={60} onChange={(e) => setContact(e.target.value)} placeholder="081 234 5678 or @yourline" />
      </div>
    </div>
  );
}

function Done({
  coach,
  result,
  summary,
  onClose,
}: {
  coach: Coach;
  result: BookingRequest | "message";
  summary: string | null;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const booking = result !== "message";
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-8 text-center" role="status">
      <motion.span
        initial={reduce ? false : { scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
        className="grid size-20 place-items-center rounded-full bg-white text-black shadow-[0_0_60px_rgb(255_255_255/0.35)]"
      >
        <Check className="size-9" strokeWidth={3} aria-hidden />
      </motion.span>
      <p className="text-statement mt-6 text-[44px]">{booking ? "Request sent" : "Message sent"}</p>
      <p className="mt-2 max-w-xs text-[15px] text-text-secondary">
        {booking
          ? `${coach.name} will confirm your session by phone or LINE.`
          : `${coach.name} will get back to you by phone or LINE.`}
      </p>
      {booking && summary ? (
        <div className="glass mt-6 w-full max-w-sm rounded-2xl px-4 py-3 text-sm">
          <p className="font-semibold">{summary}</p>
          <p className="tabular mt-1 text-xs text-text-tertiary">Reference {result.reference}</p>
        </div>
      ) : null}
      <button type="button" onClick={onClose} className="tap mt-8 h-12 rounded-full bg-white px-8 text-[15px] font-semibold text-black">
        Done
      </button>
    </div>
  );
}
