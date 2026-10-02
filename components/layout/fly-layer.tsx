"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useFly, type Flight } from "@/lib/fly-store";

function target() {
  const els = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-target]"));
  const visible = els.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  const r = visible?.getBoundingClientRect();
  return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : { x: window.innerWidth - 40, y: window.innerHeight - 40 };
}

function Dot({ flight }: { flight: Flight }) {
  const land = useFly((s) => s.land);
  const to = target();
  const midX = (flight.x + to.x) / 2;
  const peakY = Math.min(flight.y, to.y) - 120;
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-[100] size-5 rounded-full ring-2 ring-white"
      style={{ backgroundColor: flight.tint }}
      initial={{ x: flight.x - 10, y: flight.y - 10, scale: 1.4, opacity: 1 }}
      animate={{
        x: [flight.x - 10, midX - 10, to.x - 10],
        y: [flight.y - 10, peakY, to.y - 10],
        scale: [1.4, 1, 0.4],
        opacity: [1, 1, 0.6],
      }}
      transition={{ duration: 0.7, ease: [0.45, 0, 0.25, 1], times: [0, 0.45, 1] }}
      onAnimationComplete={() => land(flight.id)}
    />
  );
}

export function FlyLayer() {
  const flights = useFly((s) => s.flights);
  const reduce = useReducedMotion();
  if (reduce) return null;
  return <AnimatePresence>{flights.map((f) => <Dot key={f.id} flight={f} />)}</AnimatePresence>;
}
