"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PT_APP } from "@/content/pt-app";
import type { LoggedExercise, LoggedSet } from "./progress";

/*
 * The workout in progress lives on the phone (localStorage) until Finish, so a lost
 * signal, a locked screen or a reload in the middle of a set never loses anything.
 */

export type ActiveWorkout = {
  clientId: string;
  dayId: string;
  dayName: string;
  startedAt: string;
  entries: LoggedExercise[];
  note: string;
};

type State = {
  active: ActiveWorkout | null;
  restSeconds: number;
  beep: boolean;
  /** epoch ms when the current rest ends, or null */
  restEndsAt: number | null;
  start: (w: Omit<ActiveWorkout, "startedAt" | "note">) => void;
  discard: () => void;
  setSet: (uid: string, index: number, patch: Partial<LoggedSet>) => void;
  addSet: (uid: string) => void;
  removeSet: (uid: string) => void;
  setNote: (note: string) => void;
  setRest: (s: number) => void;
  setBeep: (b: boolean) => void;
  startRest: () => void;
  stopRest: () => void;
};

const mapEntry = (w: ActiveWorkout | null, uid: string, fn: (e: LoggedExercise) => LoggedExercise) =>
  w ? { ...w, entries: w.entries.map((e) => (e.uid === uid ? fn(e) : e)) } : w;

export const useWorkout = create<State>()(
  persist(
    (set, get) => ({
      active: null,
      restSeconds: PT_APP.defaultRest,
      beep: true,
      restEndsAt: null,
      start: (w) => set({ active: { ...w, startedAt: new Date().toISOString(), note: "" }, restEndsAt: null }),
      discard: () => set({ active: null, restEndsAt: null }),
      setSet: (uid, index, patch) => set({ active: mapEntry(get().active, uid, (e) => ({ ...e, sets: e.sets.map((s, i) => (i === index ? { ...s, ...patch } : s)) })) }),
      addSet: (uid) =>
        set({
          active: mapEntry(get().active, uid, (e) => {
            const last = e.sets.at(-1);
            return e.sets.length >= 15 ? e : { ...e, sets: [...e.sets, { weight: last?.weight ?? null, reps: last?.reps ?? null, seconds: last?.seconds ?? null, done: false }] };
          }),
        }),
      removeSet: (uid) => set({ active: mapEntry(get().active, uid, (e) => (e.sets.length <= 1 ? e : { ...e, sets: e.sets.slice(0, -1) })) }),
      setNote: (note) => set({ active: get().active ? { ...get().active!, note: note.slice(0, 500) } : null }),
      setRest: (s) => set({ restSeconds: s }),
      setBeep: (b) => set({ beep: b }),
      startRest: () => set({ restEndsAt: Date.now() + get().restSeconds * 1000 }),
      stopRest: () => set({ restEndsAt: null }),
    }),
    { name: "s1-workout", version: 1 },
  ),
);
