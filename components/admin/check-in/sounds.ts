/*
 * Front-desk sounds, synthesised with Web Audio so there are no files to load.
 * ok    = bright two-note tick
 * warn  = the tick, then "do-do-do-do" so staff know to mention renewing
 * deny  = low falling buzz
 */
export type DeskSound = "ok" | "warn" | "deny" | "neutral";

type Note = { f: number; at: number; len: number; type: OscillatorType; gain: number; glideTo?: number };

const TICK: Note[] = [
  { f: 1046.5, at: 0, len: 0.09, type: "sine", gain: 0.28 },
  { f: 1568, at: 0.085, len: 0.16, type: "sine", gain: 0.24 },
];

const CHIME: Note[] = [784, 784, 784, 1046.5].map((f, i) => ({
  f,
  at: 0.38 + i * 0.12,
  len: i === 3 ? 0.22 : 0.08,
  type: "triangle" as const,
  gain: 0.22,
}));

const BUZZ: Note[] = [
  { f: 196, at: 0, len: 0.18, type: "square", gain: 0.09, glideTo: 174 },
  { f: 147, at: 0.2, len: 0.34, type: "square", gain: 0.09, glideTo: 110 },
];

const SOUNDS: Record<DeskSound, Note[]> = {
  ok: TICK,
  warn: [...TICK, ...CHIME],
  deny: BUZZ,
  neutral: [{ f: 880, at: 0, len: 0.1, type: "sine", gain: 0.16 }],
};

let shared: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  shared ??= new Ctx();
  if (shared.state === "suspended") void shared.resume();
  return shared;
}

export function playDeskSound(kind: DeskSound) {
  try {
    const ctx = context();
    if (!ctx) return;
    const start = ctx.currentTime + 0.01;
    for (const n of SOUNDS[kind]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t = start + n.at;
      o.type = n.type;
      o.frequency.setValueAtTime(n.f, t);
      if (n.glideTo) o.frequency.exponentialRampToValueAtTime(n.glideTo, t + n.len);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(n.gain, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + n.len);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + n.len + 0.02);
    }
  } catch {
    /* no audio available: the screen still says it all */
  }
}
