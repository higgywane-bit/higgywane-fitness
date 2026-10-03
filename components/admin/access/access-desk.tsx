"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Camera,
  CameraOff,
  Check,
  CircleAlert,
  Expand,
  Plus,
  Shrink,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { checkInAction, deskFeedAction, searchMembersAction } from "@/app/admin/actions";
import { CheckInFeed } from "@/components/admin/check-in-feed";
import { MemberAvatar } from "@/components/admin/member-avatar";
import { standingLine } from "@/components/admin/member-row";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FeedItem, MemberListRow } from "@/lib/admin/queries";
import { daysLeftLabel, expiredLabel } from "@/lib/membership/access";
import { diffDays, formatDate, formatTime, localDate } from "@/lib/membership/dates";
import type { CheckInMethod, CheckInResult } from "@/lib/membership/service";
import { cn } from "@/lib/utils";
import { CameraScanner } from "../check-in/camera-scanner";
import { NewMemberQuickDialog } from "./new-member-quick-dialog";

const ALLOWED_RESET_MS = 7000;

function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = ok ? [880, 1320] : [220, 196];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = ok ? "sine" : "square";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.13;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(ok ? 0.25 : 0.08, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.13);
    });
    setTimeout(() => ctx.close(), 600);
  } catch {
    /* no audio: fine */
  }
}

function isTypingTarget(el: EventTarget | null) {
  const e = el as HTMLElement | null;
  return !!e && (e.tagName === "INPUT" || e.tagName === "TEXTAREA" || e.tagName === "SELECT" || e.isContentEditable);
}

export function AccessDesk({ initialFeed, initialCount }: { initialFeed: FeedItem[]; initialCount: number }) {
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [feed, setFeed] = useState(initialFeed);
  const [inToday, setInToday] = useState(initialCount);
  const [pending, startTransition] = useTransition();
  const [sound, setSound] = useState(true);
  const [camera, setCamera] = useState(false);
  const [focused, setFocused] = useState(true);
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<MemberListRow[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [newMember, setNewMember] = useState(false);
  const reduce = useReducedMotion();
  const lastMethod = useRef<CheckInMethod>("scan");
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const submit = useCallback((input: { code?: string; memberId?: string; method: CheckInMethod }) => {
    lastMethod.current = input.method;
    clearTimeout(resetTimer.current);
    startTransition(async () => {
      const res = await checkInAction(input);
      if (!res.ok) {
        setResult({ allowed: false, reason: "unknown-code", at: new Date().toISOString(), code: input.code });
        return;
      }
      const r = res.data.result;
      setResult(r);
      setFeed(res.data.feed);
      setInToday(res.data.inToday);
      if (soundRef.current) beep(r.allowed);
      if (r.allowed && !r.nudge) resetTimer.current = setTimeout(() => setResult(null), ALLOWED_RESET_MS);
    });
  }, []);

  useEffect(() => {
    let buffer = "";
    let last = 0;
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || newMember || e.metaKey || e.ctrlKey || e.altKey) return;
      const now = performance.now();
      if (now - last > 1500) buffer = "";
      last = now;
      if (e.key === "Enter") {
        if (buffer.length >= 3) submit({ code: buffer, method: "scan" });
        buffer = "";
        return;
      }
      if (e.key === "Escape") {
        setResult(null);
        return;
      }
      if (e.key.length === 1) buffer += e.key;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit, newMember]);

  useEffect(() => {
    const on = () => setFocused(document.hasFocus());
    on();
    window.addEventListener("focus", on);
    window.addEventListener("blur", on);
    return () => {
      window.removeEventListener("focus", on);
      window.removeEventListener("blur", on);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(async () => {
      const res = await deskFeedAction();
      if (res.ok) {
        setFeed(res.data.feed);
        setInToday(res.data.inToday);
      }
    }, 20_000);
    return () => clearInterval(id);
  }, []);

  const onSearch = useCallback(async (text: string) => {
    setQuery(text);
    if (text.length < 2) {
      setMatches([]);
      return;
    }
    const res = await searchMembersAction(text);
    if (res.ok) setMatches(res.data);
  }, []);

  const handleNewMemberCreated = async () => {
    setNewMember(false);
    const res = await deskFeedAction();
    if (res.ok) {
      setFeed(res.data.feed);
      setInToday(res.data.inToday);
    }
  };

  return (
    <div className={cn("h-screen flex flex-col bg-black overflow-hidden", fullscreen && "fixed inset-0 z-50")}>
      {/* Header */}
      <header className="border-b border-white/10 px-4 py-4 sm:px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Superfit Access</h1>
          <p className="text-xs text-text-tertiary mt-1">{inToday} members checked in today</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSound(!sound)}
            title={sound ? "Sound on" : "Sound off"}
            className="text-text-secondary hover:text-white"
          >
            {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCamera(!camera)}
            title={camera ? "Camera on" : "Camera off"}
            className="text-text-secondary hover:text-white"
          >
            {camera ? <Camera className="size-4" /> : <CameraOff className="size-4" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setFullscreen(!fullscreen)}
            className="text-text-secondary hover:text-white"
          >
            {fullscreen ? <Shrink className="size-4" /> : <Expand className="size-4" />}
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col min-h-0">
        {/* Main check-in area */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-12 min-h-0">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: reduce ? 1 : 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: reduce ? 1 : 0.95 }}
                className="w-full max-w-sm"
              >
                <div
                  className={cn(
                    "rounded-2xl p-6 text-center",
                    result.allowed ? "bg-green/10 border border-green" : "bg-red/10 border border-red"
                  )}
                >
                  <div className="flex justify-center mb-4">
                    {result.allowed ? (
                      <Check className="size-12 text-green" />
                    ) : (
                      <CircleAlert className="size-12 text-red" />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-text-tertiary mb-2">
                    {lastMethod.current === "camera" || lastMethod.current === "typed" ? result.member?.name : "Check-in"}
                  </p>
                  <h3 className="text-2xl font-bold text-white mb-4">{result.member?.name || "Unknown"}</h3>

                  {result.allowed ? (
                    <>
                      <p className="text-lg font-semibold text-green mb-2">Welcome back!</p>
                      {result.daysLeft !== undefined && (
                        <p className="text-sm text-text-secondary">
                          {result.daysLeft > 0 ? `${result.daysLeft} days left` : "Expires today"}
                        </p>
                      )}
                      {result.nudge && <p className="text-sm text-amber mt-2">Please renew soon</p>}
                    </>
                  ) : (
                    <p className="text-sm text-red mb-4">
                      {result.reason === "unknown-code"
                        ? "Code not found"
                        : result.reason === "expired"
                          ? "Membership expired"
                          : result.reason === "frozen"
                            ? "Membership paused"
                            : "Not checked in"}
                    </p>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setResult(null)}
                    className="mt-4 w-full text-xs"
                  >
                    <X className="size-3 mr-1" />
                    Next
                  </Button>
                </div>
              </motion.div>
            ) : camera ? (
              <CameraScanner key="camera" onCode={(code) => submit({ code, method: "camera" })} paused={!!result} />
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                <div className="text-5xl mb-4">📱</div>
                <p className="text-lg font-semibold text-white mb-2">Ready to scan</p>
                <p className="text-sm text-text-secondary">Point scanner or show phone</p>
              </motion.div>
            )}
          </AnimatePresence>

          {!result && (
            <div className="mt-8 w-full max-w-sm">
              <Input
                placeholder="Or search by name..."
                value={query}
                onChange={(e) => onSearch(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-text-tertiary focus:border-white/20"
              />

              {matches.length > 0 && (
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                  {matches.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => submit({ memberId: m.id, method: "search" })}
                      className="w-full flex items-center gap-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 p-2 text-left transition"
                    >
                      <MemberAvatar name={m.name} className="size-8 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{m.name}</p>
                        <p className="text-xs text-text-tertiary truncate">{standingLine(m)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with New Member button */}
        <div className="border-t border-white/10 px-4 py-4 sm:px-6 flex gap-3">
          <Button
            onClick={() => setNewMember(true)}
            className="flex-1 gap-2 bg-red hover:bg-red-hover text-white font-semibold"
          >
            <Plus className="size-4" />
            New Member
          </Button>
        </div>

        {/* Check-in feed (compact) */}
        {!result && (
          <div className="border-t border-white/10 max-h-32 overflow-y-auto">
            <CheckInFeed items={feed} />
          </div>
        )}
      </div>

      {/* New Member Dialog */}
      <NewMemberQuickDialog open={newMember} onOpenChange={setNewMember} onCreated={handleNewMemberCreated} />

      {/* Focus indicator */}
      <AnimatePresence>
        {!focused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center pointer-events-none"
          >
            <div className="bg-red rounded-lg px-4 py-2 text-sm font-semibold text-white">
              Click to activate scanner
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
