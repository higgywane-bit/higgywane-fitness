"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Plus, Search } from "lucide-react";
import { addExerciseAction } from "@/app/coach/actions";
import { inputCls, Sheet, toast } from "@/components/pt/controls";
import { Button } from "@/components/pt/ui";
import { EQUIPMENT, GROUPS, groupLabel, LOG_KINDS, searchExercises, type GroupId, type Lang, type LibraryExercise, type LogKind } from "@/lib/pt/library";
import { exerciseSummary, fromLibrary } from "@/lib/pt/program";
import { cn } from "@/lib/utils";

const defaultLabel = (e: LibraryExercise) => exerciseSummary(fromLibrary(e, "x"));

function GroupChips({ value, onChange, lang, counts }: { value: GroupId | "all"; onChange: (g: GroupId | "all") => void; lang: Lang; counts: Record<string, number> }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Body part">
      {[{ id: "all" as const, en: "All", th: "ทั้งหมด" }, ...GROUPS].map((g) => (
        <button
          key={g.id}
          type="button"
          role="tab"
          aria-selected={value === g.id}
          onClick={() => onChange(g.id)}
          className={cn("tap h-9 shrink-0 rounded-full px-3.5 text-[14px] font-semibold", value === g.id ? "bg-white text-black" : "bg-s1-surface-2 text-s1-muted hover:text-white")}
        >
          {g[lang]}
          {g.id !== "all" ? <span className="num ml-1.5 opacity-60">{counts[g.id] ?? 0}</span> : null}
        </button>
      ))}
    </div>
  );
}

function useFiltered(list: LibraryExercise[]) {
  const [group, setGroup] = useState<GroupId | "all">("all");
  const [q, setQ] = useState("");
  const counts = useMemo(() => Object.fromEntries(GROUPS.map((g) => [g.id, list.filter((e) => e.group === g.id).length])), [list]);
  const shown = useMemo(() => searchExercises(q, group === "all" ? list : list.filter((e) => e.group === group)), [list, group, q]);
  return { group, setGroup, q, setQ, counts, shown };
}

/** Phone: a sheet where you tick several exercises and add them at once. */
export function LibrarySheet({
  open,
  onOpenChange,
  dayName,
  library,
  lang,
  onAdd,
  onCustom,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dayName: string;
  library: LibraryExercise[];
  lang: Lang;
  onAdd: (list: LibraryExercise[]) => void;
  onCustom: (e: LibraryExercise) => void;
}) {
  const f = useFiltered(library);
  const [picked, setPicked] = useState<string[]>([]);
  const [custom, setCustom] = useState(false);
  const close = () => {
    setPicked([]);
    onOpenChange(false);
  };
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      title="Add exercises"
      description={`To ${dayName}`}
      left={
        <button type="button" onClick={close} className="px-2 text-[16px] font-medium text-s1-muted">
          Cancel
        </button>
      }
      right={
        <button
          type="button"
          disabled={!picked.length}
          onClick={() => {
            onAdd(picked.map((id) => library.find((e) => e.id === id)!).filter(Boolean));
            close();
          }}
          className="px-2 text-[16px] font-semibold text-s1-blue disabled:text-s1-faint"
        >
          Add{picked.length ? ` ${picked.length}` : ""}
        </button>
      }
      className="h-[92dvh]"
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-s1-faint" aria-hidden />
          <input type="search" value={f.q} onChange={(e) => f.setQ(e.target.value)} placeholder="Search exercises" aria-label="Search exercises" className={`${inputCls} h-11 pl-10`} />
        </div>
        <GroupChips value={f.group} onChange={f.setGroup} lang={lang} counts={f.counts} />
        <ul className="flex flex-col divide-y divide-s1-hairline overflow-hidden rounded-[20px] bg-s1-surface-2">
          {f.shown.map((e) => {
            const on = picked.includes(e.id);
            return (
              <li key={e.id}>
                <button type="button" aria-pressed={on} onClick={() => setPicked(on ? picked.filter((x) => x !== e.id) : [...picked, e.id])} className="tap flex min-h-[58px] w-full items-center gap-3 px-4 py-2 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold">
                      {e.name}
                      {e.custom ? <span className="ml-1.5 text-[12px] font-semibold text-s1-pink">Yours</span> : null}
                    </span>
                    <span className="block text-[13px] text-s1-muted">
                      {e.equipment}. {defaultLabel(e)}
                    </span>
                  </span>
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", on ? "bg-s1-blue text-black" : "ring-2 ring-s1-surface-4 ring-inset")} aria-hidden>
                    {on ? <Check className="size-4" strokeWidth={3} /> : null}
                  </span>
                </button>
              </li>
            );
          })}
          {!f.shown.length ? <li className="px-4 py-6 text-center text-[15px] text-s1-muted">No exercises match.</li> : null}
        </ul>
        {custom ? (
          <CustomExerciseForm
            initialGroup={f.group === "all" ? "chest" : f.group}
            initialName={f.q}
            onDone={(e) => {
              setCustom(false);
              if (e) {
                onCustom(e);
                setPicked((p) => [...p, e.id]);
              }
            }}
          />
        ) : (
          <Button variant="tinted" className="self-start" onClick={() => setCustom(true)}>
            <Plus className="size-5" aria-hidden /> Custom exercise
          </Button>
        )}
      </div>
    </Sheet>
  );
}

/** Desktop: the library sits beside the plan; one click adds to the open day. */
export function LibraryPanel({ dayName, library, lang, onAdd, onCustom }: { dayName: string | null; library: LibraryExercise[]; lang: Lang; onAdd: (e: LibraryExercise) => void; onCustom: (e: LibraryExercise) => void }) {
  const f = useFiltered(library);
  const [custom, setCustom] = useState(false);
  return (
    <aside aria-label="Exercise library" className="flex max-h-[calc(100dvh-48px)] flex-col gap-3 rounded-[24px] bg-s1-surface-1 p-4 ring-1 ring-s1-hairline">
      <div>
        <h2 className="text-[20px] font-bold tracking-tight">Exercise library</h2>
        <p className="text-[13px] text-s1-muted">{dayName ? `Click to add to ${dayName}. Sets and reps fill in from the library.` : "Add a gym day first."}</p>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-s1-faint" aria-hidden />
        <input type="search" value={f.q} onChange={(e) => f.setQ(e.target.value)} placeholder="Search exercises" aria-label="Search exercises" className={`${inputCls} h-11 pl-10`} />
      </div>
      <GroupChips value={f.group} onChange={f.setGroup} lang={lang} counts={f.counts} />
      <ul className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">
        {f.shown.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              disabled={!dayName}
              onClick={() => onAdd(e)}
              className="tap group flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left hover:bg-s1-surface-2 disabled:opacity-40"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{e.name}</span>
                <span className="block text-[12px] text-s1-faint">
                  {groupLabel(e.group, lang)} · {e.equipment} · {defaultLabel(e)}
                </span>
              </span>
              <Plus className="size-5 shrink-0 text-s1-faint group-hover:text-s1-blue" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {custom ? (
        <CustomExerciseForm
          initialGroup={f.group === "all" ? "chest" : f.group}
          initialName={f.q}
          onDone={(e) => {
            setCustom(false);
            if (e) onCustom(e);
          }}
        />
      ) : (
        <Button variant="tinted" className="self-start" onClick={() => setCustom(true)}>
          <Plus className="size-5" aria-hidden /> Custom exercise
        </Button>
      )}
    </aside>
  );
}

function CustomExerciseForm({ initialGroup, initialName, onDone }: { initialGroup: GroupId; initialName: string; onDone: (e: LibraryExercise | null) => void }) {
  const [name, setName] = useState(initialName);
  const [group, setGroup] = useState<GroupId>(initialGroup);
  const [equipment, setEquipment] = useState("Machine");
  const [log, setLog] = useState<LogKind>("weight_reps");
  const [sets, setSets] = useState(3);
  const [amount, setAmount] = useState(10);
  const [pending, start] = useTransition();
  const sel = "h-11 w-full rounded-xl bg-s1-surface-3 px-3 text-[15px] outline-none focus:ring-2 focus:ring-s1-blue/60";
  return (
    <form
      className="flex flex-col gap-2.5 rounded-[20px] bg-s1-surface-2 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await addExerciseAction({ name, group, equipment, log, sets, ...(log === "time" ? { seconds: amount } : { reps: amount }) });
          if (!res.ok) return toast.bad(res.error);
          toast.good(`${res.data.name} added to your library`);
          onDone(res.data);
        });
      }}
    >
      <p className="text-[15px] font-semibold">New exercise in your library</p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Exercise name" className={sel} required maxLength={60} />
      <div className="grid grid-cols-2 gap-2">
        <select value={group} onChange={(e) => setGroup(e.target.value as GroupId)} aria-label="Body part" className={sel}>
          {GROUPS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.en}
            </option>
          ))}
        </select>
        <select value={equipment} onChange={(e) => setEquipment(e.target.value)} aria-label="Equipment" className={sel}>
          {EQUIPMENT.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <select
          value={log}
          onChange={(e) => {
            const v = e.target.value as LogKind;
            setLog(v);
            setAmount(v === "time" ? 60 : 10);
          }}
          aria-label="Logged as"
          className={sel}
        >
          {Object.entries(LOG_KINDS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input type="number" min={1} max={10} value={sets} onChange={(e) => setSets(Number(e.target.value))} aria-label="Sets" className={sel} />
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} aria-label={log === "time" ? "Seconds" : "Reps"} className={sel} />
        </div>
      </div>
      <p className="text-[12px] text-s1-faint">Sets, then {log === "time" ? "seconds" : "reps"} per set.</p>
      <div className="flex justify-end gap-2">
        <Button variant="plain" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save exercise"}
        </Button>
      </div>
    </form>
  );
}
