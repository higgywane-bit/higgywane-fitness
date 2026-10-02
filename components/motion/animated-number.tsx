"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

type Props = {
  value: number;
  format?: (n: number) => string;
  className?: string;
};

/** Counts up/down to `value`. Renders the final value on the server and with reduced motion. */
export function AnimatedNumber({ value, format = (n) => String(Math.round(n)), className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(value);
  const reduce = useReducedMotion();
  const formatRef = useRef(format);
  formatRef.current = format;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = formatRef.current;
    if (reduce || from.current === value) {
      el.textContent = fmt(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (n) => {
        el.textContent = fmt(n);
      },
    });
    from.current = value;
    return () => controls.stop();
  }, [value, reduce]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
