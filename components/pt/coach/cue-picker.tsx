"use client";

import { useState, useTransition } from "react";
import { Check, Plus } from "lucide-react";
import { addCueAction } from "@/app/coach/actions";
import { inputCls, Sheet, toast } from "@/components/pt/controls";
import { Button } from "@/components/pt/ui";
import { CUE_GROUPS, cueText, type Cue, type CueGroupId, type Lang } from "@/lib/pt/library";
import { LIMITS, type PlanCue } from "@/lib/pt/program";
import { cn } from "@/lib/utils";

/** Pick coaching notes for one exercise, grouped Form / Tempo / Effort, or write your own. */
export function CuePicker({
  open,
  onOpenChange,
  exerciseName,
  cues,
  selected,
  lang,
  onToggle,
  onCustom,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  exerciseName: string;
  cues: Cue[];
  selected: PlanCue[];
  lang: Lang;
  onToggle: (c: Cue) => void;
  onCustom: (c: Cue) => void;
}) {
  const [text, setText] = useState("");
  const [group, setGroup] = useState<CueGroupId>("form");
  const [pending, start] = useTransition();
  const full = selected.length >= LIMITS.cues;
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Note for ${exerciseName}`}
      description={full ? `That's ${LIMITS.cues}, the most for one exercise.` : "Tap to add or remove. Your client sees these while training."}
      right={
        <button type="button" onClick={() => onOpenChange(false)} className="px-2 text-[16px] font-semibold text-s1-blue">
          Done
        </button>
      }
      className="h-[88dvh]"
    >
      <div className="flex flex-col gap-5">
        {CUE_GROUPS.map((g) => (
          <section key={g.id} className="flex flex-col gap-2">
            <h3 className="px-1 text-[13px] font-semibold text-s1-muted">{g[lang]}</h3>
            <div className="flex flex-wrap gap-2">
              {cues
                .filter((c) => c.group === g.id)
                .map((c) => {
                  const on = selected.some((s) => s.id === c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      disabled={!on && full}
                      onClick={() => onToggle(c)}
                      className={cn(
                        "tap inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-left text-[14px] font-medium disabled:opacity-35",
                        on ? "bg-s1-blue text-s1-on-blue" : "bg-s1-surface-2 text-white hover:bg-s1-surface-3",
                      )}
                    >
                      {on ? <Check className="size-4 shrink-0" strokeWidth={3} aria-hidden /> : null}
                      {cueText(c, lang)}
                      {c.custom ? <span className={cn("text-[11px] font-bold", on ? "text-black/60" : "text-s1-pink")}>Yours</span> : null}
                    </button>
                  );
                })}
            </div>
          </section>
        ))}
        <form
          className="flex flex-col gap-2 rounded-[20px] bg-s1-surface-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await addCueAction({ group, en: text });
              if (!res.ok) return toast.bad(res.error);
              onCustom(res.data);
              setText("");
            });
          }}
        >
          <p className="text-[15px] font-semibold">Your own cue</p>
          <div className="flex gap-2">
            <select value={group} onChange={(e) => setGroup(e.target.value as CueGroupId)} aria-label="Cue group" className="h-11 rounded-xl bg-s1-surface-3 px-3 text-[15px] outline-none">
              {CUE_GROUPS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.en}
                </option>
              ))}
            </select>
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={80} placeholder="e.g. Pinkies on the rings" aria-label="Cue" className={`${inputCls} h-11 flex-1 bg-s1-surface-3`} />
          </div>
          <Button type="submit" variant="tinted" className="self-end" disabled={pending || !text.trim() || full}>
            <Plus className="size-4" aria-hidden /> Add and use
          </Button>
        </form>
      </div>
    </Sheet>
  );
}
