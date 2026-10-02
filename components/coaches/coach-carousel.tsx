"use client";

import { ArrowRight, CalendarCheck, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Coach } from "@/content/types";
import { BookingSheet, type SheetState } from "@/components/coaches/booking-sheet";
import { CoachBackdrop, CoachCardFace, CoachHeroFace } from "@/components/coaches/coach-art";
import { haptic } from "@/lib/fly-store";
import { cn } from "@/lib/utils";

/** Horizontal distance between neighbouring cards, as a fraction of card width. */
const STEP = 0.66;
const SPRING = { type: "spring", stiffness: 210, damping: 30, mass: 0.9 } as const;

const mod = (a: number, n: number) => ((a % n) + n) % n;
/** Signed distance from the front, wrapped so the ring is endless: (-n/2, n/2]. */
function ring(d: number, n: number) {
  const m = mod(d, n);
  return m > n / 2 ? m - n : m;
}

export function CoachCarousel({ coaches }: { coaches: Coach[] }) {
  const n = coaches.length;
  const router = useRouter();
  const reduce = useReducedMotion() ?? false;
  const pos = useMotionValue(0);
  const [active, setActive] = useState(0);
  const [opening, setOpening] = useState<{ index: number; from: DOMRect; to: { top: number; height: number } } | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const cardRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const pan = useRef({ start: 0, moved: false });

  useMotionValueEvent(pos, "change", (v) => {
    const i = mod(Math.round(v), n);
    setActive((prev) => {
      if (prev !== i) haptic(6);
      return i;
    });
  });

  useEffect(() => {
    coaches.forEach((c) => router.prefetch(`/coaches/${c.slug}`));
  }, [coaches, router]);

  const stepPx = () => (cardRefs.current[0]?.offsetWidth ?? 300) * STEP;
  const settle = (target: number) => animate(pos, target, reduce ? { duration: 0 } : SPRING);
  const nudge = (d: number) => settle(Math.round(pos.get()) + d);
  const goTo = (i: number) => {
    const cur = Math.round(pos.get());
    settle(cur + ring(i - mod(cur, n), n));
  };

  const open = (i: number) => {
    if (pan.current.moved) return;
    if (i !== active) return goTo(i);
    const href = `/coaches/${coaches[i].slug}`;
    const el = cardRefs.current[i];
    if (reduce || !el) return router.push(href);
    const header = document.querySelector("header")?.getBoundingClientRect().bottom ?? 56;
    const tabbar = document.querySelector<HTMLElement>("nav.fixed")?.getBoundingClientRect();
    const bottom = tabbar && tabbar.height > 0 ? tabbar.top : window.innerHeight;
    setOpening({ index: i, from: el.getBoundingClientRect(), to: { top: header, height: bottom - header } });
  };

  const coach = coaches[active];

  return (
    <div>
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="Coaches"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") nudge(1);
          if (e.key === "ArrowLeft") nudge(-1);
        }}
        className="relative rounded-3xl focus-visible:outline-offset-8"
      >
        <motion.div
          onPanStart={() => {
            pos.stop();
            pan.current = { start: pos.get(), moved: false };
          }}
          onPan={(_, info) => {
            if (Math.abs(info.offset.x) > 6) pan.current.moved = true;
            pos.set(pan.current.start - info.offset.x / stepPx());
          }}
          onPanEnd={(_, info) => {
            const projected = pos.get() - (info.velocity.x / stepPx()) * 0.2;
            const start = Math.round(pan.current.start);
            settle(Math.max(start - 1, Math.min(start + 1, Math.round(projected))));
            // let the click that ends a drag see `moved`, then reset
            setTimeout(() => (pan.current.moved = false), 0);
          }}
          className="relative mx-auto h-[min(105vw,510px)] touch-pan-y select-none [perspective:1100px] md:h-[540px]"
        >
          <div className="absolute inset-0 [transform-style:preserve-3d]">
            {coaches.map((c, i) => (
              <Card
                key={c.slug}
                coach={c}
                index={i}
                total={n}
                pos={pos}
                reduce={reduce}
                hidden={opening?.index === i}
                active={i === active}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                onOpen={() => open(i)}
              />
            ))}
          </div>
        </motion.div>
        <p className="sr-only" aria-live="polite">
          {coach.name}, {coach.title}. {active + 1} of {n}.
        </p>
      </div>

      {/* names + arrows */}
      <div className="mt-4 flex items-center justify-between gap-2 md:mt-8 md:mx-auto md:max-w-xl">
        <button type="button" onClick={() => nudge(-1)} aria-label="Previous coach" className="tap glass grid size-11 shrink-0 place-items-center rounded-full">
          <ChevronLeft className="size-5" />
        </button>
        <ul className="flex min-w-0 items-center justify-center gap-1">
          {coaches.map((c, i) => {
            const on = i === active;
            return (
              <li key={c.slug}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={on ? "true" : undefined}
                  className={cn(
                    "tap relative flex h-11 items-center px-2.5 font-display text-[22px] uppercase md:px-4 md:text-[26px]",
                    on ? "text-white" : "text-white/35 hover:text-white/70",
                  )}
                >
                  {c.name}
                  {on ? (
                    <motion.span layoutId="coach-name-bar" className="absolute inset-x-2.5 bottom-1 h-0.5 rounded-full bg-red md:inset-x-4" transition={SPRING} />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={() => nudge(1)} aria-label="Next coach" className="tap glass grid size-11 shrink-0 place-items-center rounded-full">
          <ChevronRight className="size-5" />
        </button>
      </div>

      {/* actions for the coach in front */}
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2.5 md:mt-5 md:mx-auto md:max-w-xl">
        <button
          type="button"
          onClick={() => setSheet({ mode: "book" })}
          className="tap flex h-14 items-center justify-center gap-2 rounded-full bg-red px-6 text-base font-semibold text-white hover:bg-red-hover active:bg-red-press"
        >
          <CalendarCheck className="size-5" aria-hidden />
          <span>
            Book with <AnimatedName name={coach.name} />
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSheet({ mode: "message" })}
          aria-label={`Message ${coach.name}`}
          className="tap glass flex h-14 items-center gap-2 rounded-full px-5 text-[15px] font-semibold"
        >
          <MessageCircle className="size-5" aria-hidden />
          <span className="hidden sm:inline">Message</span>
        </button>
      </div>
      <Link
        href={`/coaches/${coach.slug}`}
        className="tap mx-auto mt-3 flex h-11 w-fit items-center gap-1.5 px-3 text-sm font-medium text-text-secondary hover:text-white"
      >
        See {coach.name}&apos;s full profile <ArrowRight className="size-4" aria-hidden />
      </Link>

      <BookingSheet coach={coach} state={sheet} onClose={() => setSheet(null)} />

      <AnimatePresence>
        {opening ? (
          <motion.div
            key="opening"
            aria-hidden
            className="fixed z-[70] isolate overflow-hidden"
            initial={{
              top: opening.from.top,
              left: opening.from.left,
              width: opening.from.width,
              height: opening.from.height,
              borderRadius: 32,
            }}
            animate={{ top: opening.to.top, left: 0, width: window.innerWidth, height: opening.to.height, borderRadius: 0 }}
            transition={{ type: "spring", stiffness: 190, damping: 28, mass: 0.9 }}
            onAnimationComplete={() => router.push(`/coaches/${coaches[opening.index].slug}`)}
          >
            <CoachBackdrop coach={coaches[opening.index]} index={opening.index} variant="hero" />
            <motion.div className="h-full" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.35 }}>
              <CoachHeroFace coach={coaches[opening.index]} />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function AnimatedName({ name }: { name: string }) {
  return (
    <span className="relative inline-grid overflow-hidden align-bottom">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={name}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          {name}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Card({
  coach,
  index,
  total,
  pos,
  reduce,
  hidden,
  active,
  ref,
  onOpen,
}: {
  coach: Coach;
  index: number;
  total: number;
  pos: MotionValue<number>;
  reduce: boolean;
  hidden: boolean;
  active: boolean;
  ref: (el: HTMLAnchorElement | null) => void;
  onOpen: () => void;
}) {
  const transform = useTransform(pos, (p) => {
    const o = ring(index - p, total);
    const a = Math.abs(o);
    if (reduce) return `translateX(${o * (STEP + 0.1) * 100}%)`;
    const rot = Math.max(-80, Math.min(80, o * -46));
    return `translate3d(${o * STEP * 100}%,0,${-a * 170}px) rotateY(${rot}deg) scale(${1 - Math.min(a, 1.5) * 0.05})`;
  });
  const opacity = useTransform(pos, (p) => {
    const a = Math.abs(ring(index - p, total));
    return a <= 1 ? 1 : Math.max(0, 1 - (a - 1) * 1.6);
  });
  const zIndex = useTransform(pos, (p) => 10 - Math.round(Math.abs(ring(index - p, total)) * 2));
  const shade = useTransform(pos, (p) => Math.min(1, Math.abs(ring(index - p, total))) * 0.6);
  const sheen = useTransform(pos, (p) => `${50 - ring(index - p, total) * 90}% 0`);

  return (
    <motion.a
      ref={ref}
      href={`/coaches/${coach.slug}`}
      onClick={(e) => {
        e.preventDefault();
        onOpen();
      }}
      draggable={false}
      tabIndex={active ? 0 : -1}
      aria-hidden={active ? undefined : true}
      aria-label={`${coach.name}, ${coach.title}. Open profile`}
      style={{ transform, opacity, zIndex, visibility: hidden ? "hidden" : "visible" }}
      className="absolute inset-x-0 top-0 mx-auto block aspect-[3/4.25] w-[74vw] max-w-[360px] overflow-hidden rounded-[32px] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.9)] [backface-visibility:hidden] isolate focus-visible:outline-offset-4 md:max-w-[380px]"
    >
      <CoachBackdrop coach={coach} index={index} variant="card" sheen={reduce ? undefined : sheen} />
      <CoachCardFace coach={coach} index={index} total={total} />
      <motion.span aria-hidden className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: shade }} />
    </motion.a>
  );
}
