"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { copy, LOCALES, type Locale } from "@/content/leah/persona";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useHydrated } from "@/hooks/use-hydrated";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { useLeah } from "@/lib/leah/store";
import { cn } from "@/lib/utils";
import { LeahAvatar } from "./leah-avatar";
import { LeahChat } from "./leah-chat";

const BUBBLE = 56;
const SPRING = { type: "spring", stiffness: 520, damping: 40 } as const;

/** Routes where a floating bubble would cover a primary action (checkout, product add bar). */
function bubbleHidden(pathname: string) {
  return pathname.startsWith("/checkout") || pathname.startsWith("/order/") || /^\/cafe\/[^/]+/.test(pathname);
}

/** Coach profiles have a sticky booking bar above the tab bar: sit on top of it. */
function extraLift(pathname: string) {
  return /^\/coaches\/[^/]+/.test(pathname) ? 72 : 0;
}

export function Leah() {
  const hydrated = useHydrated();
  const pathname = usePathname();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const open = useLeah((s) => s.open);
  const dismissed = useLeah((s) => s.dismissed);
  const locale = useLeah((s) => s.locale);
  const localeChosen = useLeah((s) => s.localeChosen);
  const setOpen = useLeah((s) => s.setOpen);
  const setLocale = useLeah((s) => s.setLocale);
  const [toast, setToast] = useState(false);
  const bubbleRef = useRef<HTMLButtonElement>(null);

  // first visit: speak the browser's language if Leah does
  useEffect(() => {
    if (!hydrated || localeChosen) return;
    const match = navigator.languages
      .map((l) => l.slice(0, 2).toLowerCase())
      .find((l): l is Locale => (LOCALES as readonly string[]).includes(l));
    if (match) setLocale(match, false);
  }, [hydrated, localeChosen, setLocale]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(false), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => bubbleRef.current?.focus({ preventScroll: true }));
  }, [setOpen]);

  if (!hydrated) return null;

  const showBubble = !dismissed && !bubbleHidden(pathname) && !(open && !desktop);
  const bottom = desktop
    ? "24px"
    : `calc(var(--tabbar-h) + env(safe-area-inset-bottom) + ${12 + extraLift(pathname)}px)`;

  return (
    <>
      <AnimatePresence>
        {showBubble ? (
          <Bubble
            key="bubble"
            ref={bubbleRef}
            bottom={bottom}
            desktop={desktop}
            onDismissed={() => setToast(true)}
          />
        ) : null}
      </AnimatePresence>

      {desktop ? (
        <DesktopPanel open={open} onClose={close} />
      ) : (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="h-[90dvh] pb-safe" aria-describedby="leah-desc">
            <DrawerDescription id="leah-desc" className="sr-only">
              {copy[locale].intro}
            </DrawerDescription>
            <LeahChat Title={DrawerTitle} onClose={() => setOpen(false)} onNavigate={() => setOpen(false)} />
          </DrawerContent>
        </Drawer>
      )}

      <UndoToast show={toast} onUndo={() => setToast(false)} desktop={desktop} />
    </>
  );
}

/* ------------------------------------------------------------------ bubble */

type BubbleProps = {
  ref: React.Ref<HTMLButtonElement>;
  bottom: string;
  desktop: boolean;
  onDismissed: () => void;
};

function Bubble({ ref, bottom, desktop, onDismissed }: BubbleProps) {
  const reduce = useReducedMotion();
  const locale = useLeah((s) => s.locale);
  const open = useLeah((s) => s.open);
  const side = useLeah((s) => s.side);
  const setOpen = useLeah((s) => s.setOpen);
  const setSide = useLeah((s) => s.setSide);
  const dismiss = useLeah((s) => s.dismiss);
  const t = copy[locale];

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [dragging, setDragging] = useState(false);
  const [overTarget, setOverTarget] = useState(false);
  const moved = useRef(false);
  const wrap = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLDivElement>(null);

  const gutter = desktop ? 24 : 16;
  const restX = useCallback(
    (s: "left" | "right") => (s === "left" ? gutter : window.innerWidth - gutter - BUBBLE),
    [gutter],
  );

  // rest on the chosen edge, and stay there when the viewport changes
  useLayoutEffect(() => {
    x.set(restX(side));
    const onResize = () => x.set(restX(useLeah.getState().side));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [restX, side, x]);

  const isOverTarget = () => {
    const a = wrap.current?.getBoundingClientRect();
    const b = target.current?.getBoundingClientRect();
    if (!a || !b) return false;
    const dx = a.left + a.width / 2 - (b.left + b.width / 2);
    const dy = a.top + a.height / 2 - (b.top + b.height / 2);
    return Math.hypot(dx, dy) < 64;
  };

  const hide = () => {
    dismiss();
    onDismissed();
  };

  return (
    <>
      <AnimatePresence>
        {dragging ? <DismissTarget ref={target} active={overTarget} label={t.dragHint} desktop={desktop} /> : null}
      </AnimatePresence>

      <motion.div
        ref={wrap}
        drag
        dragMomentum={false}
        dragElastic={0}
        style={{ x, y, bottom, left: 0 }}
        initial={reduce ? false : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.4, transition: { duration: 0.18 } }}
        transition={SPRING}
        onDragStart={() => {
          moved.current = true;
          setDragging(true);
        }}
        onDrag={() => {
          const over = isOverTarget();
          if (over !== overTarget) setOverTarget(over);
        }}
        onDragEnd={() => {
          setDragging(false);
          setOverTarget(false);
          requestAnimationFrame(() => (moved.current = false));
          if (isOverTarget()) {
            hide();
            return;
          }
          const rect = wrap.current!.getBoundingClientRect();
          const next = rect.left + rect.width / 2 < window.innerWidth / 2 ? "left" : "right";
          setSide(next);
          animate(x, restX(next), SPRING);
          animate(y, 0, SPRING);
        }}
        className="group fixed z-40 touch-none"
      >
        <button
          ref={ref}
          type="button"
          aria-label={open ? t.close : t.open}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => {
            if (moved.current) return;
            setOpen(!open);
          }}
          className={cn(
            "tap relative grid size-14 place-items-center rounded-full shadow-[0_14px_34px_-10px_rgb(0_0_0/0.95),0_0_0_1px_rgb(255_255_255/0.14)] transition-transform",
            dragging && "scale-105 cursor-grabbing",
          )}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {open ? (
              <motion.span
                key="x"
                initial={{ opacity: 0, rotate: -45 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 45 }}
                className="grid size-14 place-items-center rounded-full bg-surface-3 text-white"
              >
                <X className="size-6" />
              </motion.span>
            ) : (
              <motion.span key="face" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <LeahAvatar size={BUBBLE} online />
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* pointer and keyboard users: hide without dragging */}
        {desktop && !open ? (
          <button
            type="button"
            aria-label={t.hide}
            title={t.dismissTarget}
            onClick={hide}
            className={cn(
              "absolute -top-1.5 grid size-6 place-items-center rounded-full bg-surface-4 text-white opacity-0 shadow-[0_0_0_1px_rgb(255_255_255/0.16)] transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
              "after:absolute after:-inset-2.5 after:content-['']",
              side === "right" ? "-left-1.5" : "-right-1.5",
            )}
          >
            <X className="size-3.5" strokeWidth={2.5} />
          </button>
        ) : null}
      </motion.div>
    </>
  );
}

function DismissTarget({ ref, active, label, desktop }: { ref: React.Ref<HTMLDivElement>; active: boolean; label: string; desktop: boolean }) {
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[39] flex h-72 flex-col items-center justify-end bg-gradient-to-t from-black from-25% via-black/70 to-transparent"
      style={{ paddingBottom: desktop ? 32 : "calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 24px)" }}
    >
      <p className="mb-3 text-[13px] font-medium text-white/70">{label}</p>
      <motion.div
        ref={ref}
        animate={{ scale: active ? 1.18 : 1 }}
        transition={SPRING}
        className={cn(
          "grid size-[60px] place-items-center rounded-full transition-colors",
          active ? "bg-white text-black" : "glass text-white",
        )}
      >
        <X className="size-6" />
      </motion.div>
    </motion.div>
  );
}

function UndoToast({ show, onUndo, desktop }: { show: boolean; onUndo: () => void; desktop: boolean }) {
  const locale = useLeah((s) => s.locale);
  const restore = useLeah((s) => s.restore);
  const t = copy[locale];
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={SPRING}
          className="fixed inset-x-0 z-40 flex justify-center px-4"
          style={{ bottom: desktop ? 24 : "calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 12px)" }}
        >
          <div className="flex h-12 items-center gap-1 rounded-full bg-surface-3/90 pr-1 pl-5 text-sm text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1),0_20px_50px_-15px_rgb(0_0_0/0.9)] backdrop-blur-2xl">
            <span>{t.hidden}</span>
            <button
              type="button"
              onClick={() => {
                restore();
                onUndo();
              }}
              className="tap h-10 rounded-full px-4 font-semibold text-white hover:bg-white/10"
            >
              {t.undo}
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ desktop panel */

function PanelTitle({ className, children, id }: { className?: string; children: ReactNode; id: string }) {
  return (
    <h2 id={id} className={className}>
      {children}
    </h2>
  );
}

function DesktopPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduce = useReducedMotion();
  const side = useLeah((s) => s.side);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const Title = useCallback((p: { className?: string; children: ReactNode }) => <PanelTitle {...p} id={titleId} />, [titleId]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.section
          role="dialog"
          aria-modal={false}
          aria-labelledby={titleId}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.16 } }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          style={{ transformOrigin: side === "right" ? "bottom right" : "bottom left" }}
          className={cn(
            "fixed bottom-[92px] z-[45] flex h-[min(680px,calc(100dvh-124px))] w-[400px] flex-col overflow-hidden rounded-[28px] bg-surface-1 shadow-[inset_0_0_0_1px_var(--hairline-strong),0_40px_100px_-20px_rgb(0_0_0/0.95)]",
            side === "right" ? "right-6" : "left-6",
          )}
        >
          <LeahChat Title={Title} onClose={onClose} onNavigate={() => {}} autoFocus />
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
