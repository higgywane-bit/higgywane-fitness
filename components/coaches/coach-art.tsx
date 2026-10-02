"use client";

import { CalendarCheck, MessageCircle } from "lucide-react";
import { motion, type MotionValue } from "motion/react";
import type { Coach } from "@/content/types";
import { specialties } from "@/content/coaches";
import { SPECIALTY_ICON } from "@/components/coaches/specialty-icon";
import { cn } from "@/lib/utils";

// Where the red light sits on each coach's card, so the four feel related but distinct.
const LIGHT = ["12% 108%", "92% 104%", "8% 0%", "96% 6%"];

/** Typographic "portrait": no photo, just light, type and glass. Fills its positioned parent. */
export function CoachBackdrop({
  coach,
  index,
  variant,
  sheen,
}: {
  coach: Coach;
  index: number;
  variant: "card" | "hero" | "mini";
  sheen?: MotionValue<string>;
}) {
  const light = LIGHT[index % LIGHT.length];
  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden bg-[linear-gradient(165deg,#1d1d1d_0%,#0c0c0c_46%,#000_100%)]">
      <div
        className="absolute inset-0"
        style={{ backgroundImage: `radial-gradient(75% 55% at ${light}, rgb(225 29 72 / 0.32), transparent 70%)` }}
      />
      <span
        className={cn(
          "text-statement absolute leading-none text-transparent select-none [-webkit-text-stroke:1.5px_rgb(255_255_255/0.14)]",
          variant === "card" && "-top-[6%] -right-[14%] text-[420px]",
          variant === "mini" && "-top-[10%] -right-[18%] text-[220px]",
          variant === "hero" && "-top-[4%] -right-[10%] text-[min(150vw,860px)] md:right-[2%]",
        )}
      >
        {coach.name[0]}
      </span>
      {/* thin diagonal kit stripes */}
      <div className="absolute -top-1/4 -left-1/4 h-[150%] w-[150%] rotate-[-24deg] bg-[repeating-linear-gradient(90deg,transparent_0_46%,rgb(255_255_255/0.035)_46%_46.4%,transparent_46.4%_48%,rgb(255_255_255/0.035)_48%_48.4%,transparent_48.4%_100%)]" />
      {sheen ? (
        <motion.div
          className="absolute inset-0 bg-[linear-gradient(105deg,transparent_35%,rgb(255_255_255/0.09)_48%,transparent_62%)] bg-[length:250%_100%]"
          style={{ backgroundPosition: sheen }}
        />
      ) : null}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
      <div className="absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgb(255_255_255/0.12),inset_0_0_0_1px_rgb(255_255_255/0.08)]" />
    </div>
  );
}

export function SpecialtyIcons({ coach, size = "card" }: { coach: Coach; size?: "card" | "hero" }) {
  return (
    <ul className={cn("grid grid-cols-4", size === "card" ? "gap-1.5" : "max-w-md gap-3")}>
      {coach.specialties.slice(0, 4).map((id) => {
        const Icon = SPECIALTY_ICON[id];
        return (
          <li key={id} className="flex flex-col items-center gap-1.5 text-center">
            <span
              className={cn(
                "glass grid place-items-center rounded-full text-white",
                size === "card" ? "size-11" : "size-14",
              )}
            >
              <Icon className={size === "card" ? "size-5" : "size-6"} strokeWidth={1.75} aria-hidden />
            </span>
            <span
              className={cn(
                "leading-tight font-semibold text-white/80",
                size === "card" ? "text-[10px]" : "text-xs",
              )}
            >
              {specialties[id].label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Content of a carousel card. */
export function CoachCardFace({ coach, index, total }: { coach: Coach; index: number; total: number }) {
  return (
    <div className="flex h-full flex-col justify-between p-5">
      <div className="flex items-center justify-between text-[11px] font-semibold tracking-[0.18em] text-white/60 uppercase">
        <span>Supercoach</span>
        <span className="tabular">
          {String(index + 1).padStart(2, "0")}
          <span className="text-white/30"> / {String(total).padStart(2, "0")}</span>
        </span>
      </div>
      <div>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-white/60 uppercase">{coach.title}</p>
        <p className="text-statement mt-1 text-[88px] leading-[0.84] text-white">{coach.name}</p>
        <p className="mt-2 text-sm text-white/75">{coach.tagline}</p>
        <div className="mt-4">
          <SpecialtyIcons coach={coach} />
        </div>
      </div>
    </div>
  );
}

/** Content of the profile hero (also used for the card → profile expansion). */
export function CoachHeroFace({ coach, onBook, onMessage }: { coach: Coach; onBook?: () => void; onMessage?: () => void }) {
  const live = Boolean(onBook);
  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-1 flex-col justify-end px-5 pt-20 pb-8 md:px-8 md:pb-14">
      <p className="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">{coach.title}</p>
      <h1 className="text-statement mt-2 text-[clamp(104px,30vw,220px)] leading-[0.82]">{coach.name}</h1>
      <p className="mt-3 text-lg text-white/80 md:text-xl">{coach.tagline}</p>
      <div className="mt-6">
        <SpecialtyIcons coach={coach} size="hero" />
      </div>
      {/* rendered inert during the card expansion so the layout matches the profile exactly */}
      <div className="mt-7 flex gap-3" aria-hidden={live ? undefined : true} inert={!live}>
        <button
          type="button"
          onClick={onBook}
          className="tap flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-red px-5 text-base font-semibold whitespace-nowrap text-white hover:bg-red-hover active:bg-red-press sm:flex-none sm:px-7"
        >
          <CalendarCheck className="size-5 shrink-0" aria-hidden /> Book with {coach.name}
        </button>
        <button type="button" onClick={onMessage} className="tap glass flex h-14 shrink-0 items-center gap-2 rounded-full px-5 text-[15px] font-semibold">
          <MessageCircle className="size-5" aria-hidden /> Message
        </button>
      </div>
    </div>
  );
}
