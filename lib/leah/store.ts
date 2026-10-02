"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Locale } from "@/content/leah/persona";
import type { StreamEvent } from "./protocol";

export type LeahMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "streaming" | "done" | "error";
};

type LeahState = {
  messages: LeahMessage[];
  locale: Locale;
  /** true once the visitor picks a language, so browser detection stops applying */
  localeChosen: boolean;
  /** hidden for this browser session (bubble flicked away) */
  dismissed: boolean;
  /** which screen edge the bubble rests on */
  side: "left" | "right";
  open: boolean;
  busy: boolean;
  setOpen: (open: boolean) => void;
  setLocale: (locale: Locale, chosen?: boolean) => void;
  setSide: (side: "left" | "right") => void;
  dismiss: () => void;
  restore: () => void;
  send: (text: string) => Promise<void>;
  retry: () => void;
  reset: () => void;
};

const id = () => Math.random().toString(36).slice(2, 10);

let controller: AbortController | null = null;

export const useLeah = create<LeahState>()(
  persist(
    (set, get) => {
      const patchLast = (fn: (m: LeahMessage) => LeahMessage) =>
        set((s) => ({ messages: s.messages.map((m, i) => (i === s.messages.length - 1 ? fn(m) : m)) }));

      async function stream() {
        controller?.abort();
        controller = new AbortController();
        const history = get()
          .messages.filter((m) => m.status === "done" || m.role === "user")
          .map(({ role, content }) => ({ role, content }));
        set((s) => ({
          busy: true,
          messages: [...s.messages, { id: id(), role: "assistant", content: "", status: "streaming" }],
        }));

        try {
          const res = await fetch("/api/leah", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: history, locale: get().locale }),
            signal: controller.signal,
          });
          if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

          const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
          let buffer = "";
          let finished = false;
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.trim()) continue;
              const event = JSON.parse(line) as StreamEvent;
              if (event.type === "delta") patchLast((m) => ({ ...m, content: m.content + event.text }));
              else if (event.type === "reset") patchLast((m) => ({ ...m, content: "" }));
              else if (event.type === "error") throw new Error(event.message);
              else if (event.type === "done") finished = true;
            }
          }
          if (!finished) throw new Error("Stream ended early");
          patchLast((m) => ({ ...m, status: "done" }));
        } catch (error) {
          if ((error as Error).name === "AbortError") return;
          patchLast((m) => ({ ...m, status: "error" }));
        } finally {
          set({ busy: false });
        }
      }

      return {
        messages: [],
        locale: "en",
        localeChosen: false,
        dismissed: false,
        side: "right",
        open: false,
        busy: false,
        setOpen: (open) => set({ open }),
        setLocale: (locale, chosen = true) => set((s) => ({ locale, localeChosen: s.localeChosen || chosen })),
        setSide: (side) => set({ side }),
        dismiss: () => set({ dismissed: true, open: false }),
        restore: () => set({ dismissed: false }),
        send: async (text) => {
          const content = text.trim();
          if (!content || get().busy) return;
          set((s) => ({ messages: [...s.messages, { id: id(), role: "user", content, status: "done" }] }));
          await stream();
        },
        retry: () => {
          if (get().busy) return;
          // drop the failed reply and ask again
          set((s) => ({ messages: s.messages.filter((m, i) => !(i === s.messages.length - 1 && m.status === "error")) }));
          void stream();
        },
        reset: () => {
          controller?.abort();
          set({ messages: [], busy: false });
        },
      };
    },
    {
      name: "superfit-leah",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        // an unfinished reply can't resume after a reload: keep only settled messages
        messages: s.messages.filter((m) => m.status !== "streaming"),
        locale: s.locale,
        localeChosen: s.localeChosen,
        dismissed: s.dismissed,
        side: s.side,
      }),
    },
  ),
);
