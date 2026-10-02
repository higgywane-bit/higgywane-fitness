"use client";

import { ArrowRight, ChevronLeft, MessageCircle } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { coaches, specialties } from "@/content/coaches";
import type { Coach } from "@/content/types";
import { BookingSheet, type SheetState } from "@/components/coaches/booking-sheet";
import { CoachBackdrop, CoachHeroFace } from "@/components/coaches/coach-art";
import { SPECIALTY_ICON } from "@/components/coaches/specialty-icon";
import { formatTHB } from "@/lib/format";
import { lowestPerSession, ptPackages } from "@/lib/pricing";

function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      className={className}
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.section>
  );
}

function SectionTitle({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold tracking-[0.18em] text-text-tertiary uppercase">{kicker}</p>
      <h2 className="mt-1 font-display text-[40px] uppercase md:text-[52px]">{children}</h2>
    </div>
  );
}

export function CoachProfile({ coach }: { coach: Coach }) {
  const index = coaches.findIndex((c) => c.slug === coach.slug);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [heroGone, setHeroGone] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const packages = ptPackages();
  const others = coaches.filter((c) => c.slug !== coach.slug);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setHeroGone(!e.isIntersecting), { rootMargin: "-40% 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const book = (packageId?: string) => setSheet({ mode: "book", packageId });
  const message = () => setSheet({ mode: "message" });

  return (
    <div className="overflow-x-clip">
      <section
        ref={heroRef}
        className="relative isolate min-h-[calc(100svh-var(--header-h)-var(--tabbar-h)-env(safe-area-inset-top)-env(safe-area-inset-bottom))] md:min-h-[calc(100svh-4rem)]"
      >
        <CoachBackdrop coach={coach} index={index} variant="hero" />
        <div className="absolute inset-x-0 top-4 z-10 mx-auto max-w-6xl px-4 md:top-6 md:px-8">
          <Link href="/coaches" className="tap glass flex h-11 w-fit items-center gap-1 rounded-full pr-4 pl-2.5 text-sm font-semibold">
            <ChevronLeft className="size-5" aria-hidden /> Coaches
          </Link>
        </div>
        <div className="flex min-h-[inherit] flex-col">
          <CoachHeroFace coach={coach} onBook={() => book()} onMessage={message} />
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-20 px-4 pt-16 pb-28 md:space-y-28 md:px-8 md:pt-24 md:pb-24">
        <Reveal>
          <SectionTitle kicker="Specialties">What {coach.name} coaches</SectionTitle>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {coach.specialties.map((id) => {
              const Icon = SPECIALTY_ICON[id];
              return (
                <li key={id} className="glass rounded-3xl p-4 md:p-5">
                  <span className="grid size-10 place-items-center rounded-full bg-white text-black shadow-[0_0_30px_rgb(255_255_255/0.18)] md:size-12">
                    <Icon className="size-5 md:size-6" strokeWidth={1.75} aria-hidden />
                  </span>
                  <h3 className="mt-4 font-display text-[22px] leading-none uppercase md:mt-5 md:text-[26px]">{specialties[id].label}</h3>
                  <p className="mt-1.5 text-[13px] leading-snug text-text-secondary md:text-sm">{specialties[id].blurb}</p>
                </li>
              );
            })}
          </ul>
        </Reveal>

        <Reveal className="grid gap-8 md:grid-cols-[1fr_1.4fr] md:gap-16">
          <SectionTitle kicker="About">Meet {coach.name}</SectionTitle>
          <div className="space-y-4 text-[17px] leading-relaxed text-text-secondary md:pt-6 md:text-lg">
            {coach.about.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </Reveal>

        <Reveal>
          <SectionTitle kicker="How it works">Coaching with {coach.name}</SectionTitle>
          <ol className="grid gap-3 md:grid-cols-3">
            {coach.approach.map((s, i) => (
              <li key={s.title} className="glass relative overflow-hidden rounded-3xl p-5 md:p-6">
                <span aria-hidden className="text-statement absolute -top-3 -right-1 text-[96px] text-transparent [-webkit-text-stroke:1.5px_rgb(255_255_255/0.12)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-[28px] uppercase">{s.title}</h3>
                <p className="mt-2 max-w-[28ch] text-[15px] text-text-secondary">{s.body}</p>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal>
          <SectionTitle kicker="Personal training">Train with {coach.name}</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {packages.map((p) => (
              <li key={p.id} className="glass flex flex-col rounded-3xl p-5">
                <div className="flex items-start justify-between">
                  <p className="font-display tabular text-[56px] leading-none">{p.sessions}</p>
                  {p.saving ? (
                    <span className="tabular rounded-full bg-red-tint px-2.5 py-1 text-xs font-semibold text-red-text">Save {formatTHB(p.saving)}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm font-semibold text-text-secondary">{p.sessions === 1 ? "session" : "sessions"}</p>
                <p className="tabular mt-5 text-2xl font-bold">{formatTHB(p.price)}</p>
                <p className="tabular text-xs text-text-tertiary">{formatTHB(p.perSession)} per session</p>
                <button
                  type="button"
                  onClick={() => book(p.id)}
                  className="tap mt-5 flex h-12 items-center justify-center gap-1.5 rounded-full bg-white text-[15px] font-semibold text-black hover:bg-white/90"
                >
                  Book {p.sessions === 1 ? "a session" : "package"}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={message}
            className="tap glass mt-3 flex w-full items-center justify-between gap-4 rounded-3xl px-5 py-5 text-left"
          >
            <span>
              <span className="block text-[17px] font-semibold">Not sure where to start?</span>
              <span className="block text-sm text-text-secondary">Message {coach.name} with your goal and get a recommendation.</span>
            </span>
            <MessageCircle className="size-6 shrink-0" aria-hidden />
          </button>
        </Reveal>

        <Reveal>
          <SectionTitle kicker="The team">Other coaches</SectionTitle>
          <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
            {others.map((c) => (
              <li key={c.slug} className="w-[62vw] max-w-[260px] shrink-0 snap-start md:w-auto md:max-w-none">
                <Link href={`/coaches/${c.slug}`} className="tap relative isolate flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-3xl p-4 md:aspect-[5/4] md:p-6">
                  <CoachBackdrop coach={c} index={coaches.indexOf(c)} variant="mini" />
                  <span className="text-[11px] font-semibold tracking-[0.16em] text-white/60 uppercase">{c.title}</span>
                  <span className="text-statement text-[56px] leading-[0.85]">{c.name}</span>
                  <span className="mt-2 flex items-center gap-1 text-sm font-medium text-white/80">
                    View profile <ArrowRight className="size-4" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      {/* sticky booking bar once the hero is out of view */}
      <AnimatePresence>
        {heroGone && !sheet ? (
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="fixed inset-x-0 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+10px)] z-30 px-4 md:bottom-6"
          >
            <div className="mx-auto flex max-w-md items-center gap-2 rounded-full bg-surface-3/80 p-1.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.12),inset_0_0_0_1px_rgb(255_255_255/0.1),0_20px_50px_-15px_rgb(0_0_0/0.9)] backdrop-blur-2xl backdrop-saturate-150">
              <button
                type="button"
                onClick={() => book()}
                className="tap flex h-12 min-w-0 flex-1 items-center justify-between gap-2 rounded-full bg-red pr-4 pl-5 text-white hover:bg-red-hover"
              >
                <span className="truncate text-[15px] font-semibold">Book with {coach.name}</span>
                <span className="tabular shrink-0 text-xs text-white/80">from {formatTHB(lowestPerSession())}</span>
              </button>
              <button type="button" onClick={message} aria-label={`Message ${coach.name}`} className="tap glass grid size-12 shrink-0 place-items-center rounded-full">
                <MessageCircle className="size-5" />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <BookingSheet coach={coach} state={sheet} onClose={() => setSheet(null)} />
    </div>
  );
}
