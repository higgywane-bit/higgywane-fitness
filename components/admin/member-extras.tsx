"use client";

import { useState } from "react";
import { Pencil, StickyNote } from "lucide-react";
import { addNoteAction, setTagsAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorText, useAction } from "./kit";

export function TagEditor({ memberId, tags }: { memberId: string; tags: string[] }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tags.join(", "));
  const { run, pending, error } = useAction();
  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span key={t} className="rounded-full bg-surface-3 px-2.5 py-0.5 text-xs font-semibold text-text-secondary">
            #{t}
          </span>
        ))}
        <button type="button" onClick={() => setEditing(true)} className="tap inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs text-text-tertiary hover:bg-surface-2 hover:text-white">
          <Pencil className="size-3" aria-hidden />
          {tags.length ? "Edit tags" : "Add tags"}
        </button>
      </div>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => setTagsAction(memberId, value), () => setEditing(false));
      }}
    >
      <Input aria-label="Tags, comma separated" autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="student, vip, competitor" className="h-10 max-w-xs" />
      <Button size="sm" type="submit" disabled={pending}>
        Save
      </Button>
      <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
        Cancel
      </Button>
      <ErrorText error={error} />
    </form>
  );
}

export function NoteComposer({ memberId }: { memberId: string }) {
  const [note, setNote] = useState("");
  const { run, pending, error } = useAction();
  return (
    <form
      className="mb-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addNoteAction(memberId, note), () => setNote(""));
      }}
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <StickyNote className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-text-tertiary" aria-hidden />
          <Input aria-label="Add a note" placeholder="Add a note for the team (injury, goal, chat at the desk)…" value={note} onChange={(e) => setNote(e.target.value)} className="h-11 pl-10" />
        </div>
        <Button type="submit" variant="secondary" disabled={pending || !note.trim()}>
          Add note
        </Button>
      </div>
      <ErrorText error={error} />
    </form>
  );
}
