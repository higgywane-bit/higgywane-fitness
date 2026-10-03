"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, EyeOff, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Coach, SpecialtyId } from "@/content/types";
import { specialties } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { Chips, EditorDrawer, EditorSection, ImageUpload, SaveFooter, Switch, TextField, useSectionSave } from "./kit";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const blank = (): Coach => ({
  slug: "",
  name: "",
  title: "",
  tagline: "",
  specialties: [],
  about: [""],
  approach: [
    { title: "Assess", body: "" },
    { title: "Build", body: "" },
    { title: "Check in", body: "" },
  ],
  weekdays: [1, 2, 3, 4, 5, 6],
  slots: ["07:00", "08:00", "17:00", "18:00"],
});

export function CoachesEditor({ coaches }: { coaches: Coach[] }) {
  const [editing, setEditing] = useState<{ coach: Coach; index: number } | null>(null);
  return (
    <div className="px-4 pb-28 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-text-secondary">Profiles on the Coaches page: portrait, bio, specialties and the times they take PT bookings.</p>
        <Button variant="inverse" onClick={() => setEditing({ coach: blank(), index: -1 })}>
          <Plus className="size-4" aria-hidden /> Add coach
        </Button>
      </div>
      <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {coaches.map((c, index) => (
          <li key={c.slug}>
            <button type="button" onClick={() => setEditing({ coach: c, index })} className={cn("tap group block w-full text-left", c.hidden && "opacity-50")}>
              <span className="relative block aspect-[4/5] overflow-hidden rounded-3xl bg-surface-2">
                {c.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photo} alt="" className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                ) : (
                  <span className="absolute inset-0 grid place-items-center font-display text-[72px] text-white/15 uppercase">{c.name.slice(0, 1)}</span>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-10">
                  <span className="block font-display text-2xl leading-none uppercase">{c.name}</span>
                  <span className="mt-1 block truncate text-xs text-white/70">{c.title}</span>
                </span>
                {c.hidden ? (
                  <span className="absolute top-2 left-2 inline-flex h-7 items-center gap-1 rounded-full bg-black/70 px-2.5 text-[11px] font-semibold">
                    <EyeOff className="size-3.5" aria-hidden /> Hidden
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {editing ? <CoachEditor key={editing.index} initial={editing.coach} index={editing.index} coaches={coaches} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function CoachEditor({ initial, index, coaches, onClose }: { initial: Coach; index: number; coaches: Coach[]; onClose: () => void }) {
  const [c, setC] = useState<Coach>(initial);
  const [newSlot, setNewSlot] = useState("");
  const { save, pending, error, saved } = useSectionSave("coaches");
  const isNew = index < 0;
  const set = <K extends keyof Coach>(k: K, v: Coach[K]) => setC((s) => ({ ...s, [k]: v }));
  const commit = () => save(isNew ? [...coaches, c] : coaches.map((x, i) => (i === index ? c : x)), onClose);

  function addSlot() {
    const t = newSlot.trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) return;
    set("slots", [...new Set([...c.slots, t])].sort());
    setNewSlot("");
  }

  return (
    <EditorDrawer
      open
      onClose={onClose}
      title={isNew ? "New coach" : c.name || "Coach"}
      description="Shows on the website as soon as you save."
      footer={<SaveFooter onSave={commit} pending={pending} error={error} saved={saved} disabled={!c.name.trim() || !c.title.trim()} />}
    >
      <EditorSection title="Profile">
        <ImageUpload label="Portrait" alt={c.name} value={c.photo} onChange={(v) => set("photo", v)} aspect="aspect-[4/5]" />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Name" value={c.name} onChange={(v) => set("name", v)} maxLength={40} />
          <TextField label="Title" value={c.title} onChange={(v) => set("title", v)} placeholder="Prep & physique coach" maxLength={60} />
        </div>
        <TextField label="Tagline" value={c.tagline} onChange={(v) => set("tagline", v)} placeholder="Stage-ready, the smart way." maxLength={80} />
        <Chips label="Specialties" options={(Object.keys(specialties) as SpecialtyId[]).map((id) => ({ id, label: specialties[id].label }))} value={c.specialties} onChange={(v) => set("specialties", v)} />
        <Switch label="Show on website" description="Hidden coaches keep their history and bookings" checked={!c.hidden} onChange={(v) => set("hidden", v ? undefined : true)} />
      </EditorSection>

      <EditorSection title="Bio">
        <TextField
          label="About"
          hint="Leave a blank line between paragraphs."
          multiline
          value={c.about.join("\n\n")}
          onChange={(v) => set("about", v.split(/\n\s*\n/))}
          maxLength={2400}
        />
        <div className="space-y-3">
          <p className="text-sm font-medium text-text-secondary">How they coach</p>
          {c.approach.map((a, i) => (
            <div key={i} className="space-y-2 rounded-2xl bg-surface-2 p-3">
              <div className="flex gap-2">
                <Input aria-label="Step title" value={a.title} onChange={(e) => set("approach", c.approach.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className="flex-1" />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove step" onClick={() => set("approach", c.approach.filter((_, j) => j !== i))}>
                  <X className="size-4" />
                </Button>
              </div>
              <Input aria-label="Step text" value={a.body} onChange={(e) => set("approach", c.approach.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
            </div>
          ))}
          {c.approach.length < 6 ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => set("approach", [...c.approach, { title: "", body: "" }])}>
              <Plus className="size-4" aria-hidden /> Step
            </Button>
          ) : null}
        </div>
      </EditorSection>

      <EditorSection title="PT availability">
        <div>
          <p className="mb-2 text-sm font-medium text-text-secondary">Days</p>
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS.map((d, i) => {
              const day = i + 1;
              const on = c.weekdays.includes(day);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set("weekdays", on ? c.weekdays.filter((x) => x !== day) : [...c.weekdays, day].sort())}
                  className={cn("tap h-11 rounded-xl text-xs font-semibold", on ? "bg-white text-black" : "bg-surface-2 text-text-tertiary")}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-text-secondary">Session times</p>
          <div className="flex flex-wrap gap-1.5">
            {c.slots.map((s) => (
              <span key={s} className="tabular inline-flex h-9 items-center gap-1 rounded-full bg-surface-2 pr-1 pl-3 text-sm">
                {s}
                <button type="button" aria-label={`Remove ${s}`} onClick={() => set("slots", c.slots.filter((x) => x !== s))} className="tap grid size-7 place-items-center rounded-full hover:bg-surface-3">
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input type="time" aria-label="Add a time" value={newSlot} onChange={(e) => setNewSlot(e.target.value)} className="tabular max-w-40" />
            <Button type="button" variant="secondary" onClick={addSlot} disabled={!newSlot}>
              Add time
            </Button>
          </div>
        </div>
      </EditorSection>

      <EditorSection title="Contact">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="LINE ID" value={c.contact?.line ?? ""} onChange={(v) => set("contact", { ...c.contact, line: v || undefined })} maxLength={60} />
          <TextField label="Instagram" value={c.contact?.instagram ?? ""} onChange={(v) => set("contact", { ...c.contact, instagram: v || undefined })} placeholder="@handle" maxLength={60} />
        </div>
      </EditorSection>

      {!isNew ? (
        <Link href={`/coaches/${c.slug}`} target="_blank" className="tap inline-flex items-center gap-1.5 text-sm text-text-secondary underline-offset-4 hover:text-white hover:underline">
          View profile on the website <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </EditorDrawer>
  );
}
