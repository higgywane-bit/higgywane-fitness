import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/pt/clients";

/*
 * super1 UI kit for the PT client app and coach portal. Server-safe pieces only;
 * interactive controls live in ./controls.tsx. Tokens: app/globals.css (--s1-*).
 */

export type ButtonVariant = "primary" | "tinted" | "secondary" | "plain" | "danger" | "pink";
export type ButtonSize = "sm" | "md" | "lg";

/** Class names for a button, so links and buttons share one look. */
export function btn({ variant = "secondary", size = "md", block = false, className }: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; className?: string } = {}) {
  return cn(
    "tap inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40",
    size === "sm" && "h-9 rounded-[10px] px-3 text-[14px]",
    size === "md" && "h-11 rounded-xl px-4 text-[15px]",
    size === "lg" && "h-[54px] rounded-full px-6 text-[17px]",
    variant === "primary" && "bg-s1-blue text-s1-on-blue hover:brightness-110",
    variant === "tinted" && "bg-s1-blue-tint text-s1-blue hover:bg-s1-blue/20",
    variant === "pink" && "bg-s1-pink-tint text-s1-pink hover:bg-s1-pink/20",
    variant === "secondary" && "bg-s1-surface-2 text-s1-fg hover:bg-s1-surface-3",
    variant === "plain" && "bg-transparent px-2 text-s1-blue hover:bg-white/[0.04]",
    variant === "danger" && "bg-s1-red-tint text-s1-red hover:bg-s1-red/20",
    block && "w-full",
    className,
  );
}

export function Button({ variant, size, block, className, type = "button", ...props }: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize; block?: boolean }) {
  return <button type={type} className={btn({ variant, size, block, className })} {...props} />;
}

/** The wordmark: "super" in white, the "1" in electric blue. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline text-[22px] font-bold tracking-[-0.04em] text-white", className)} aria-label="super1">
      super<span className="text-s1-blue">1</span>
    </span>
  );
}

/** Round app mark used in headers. */
export function Mark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-8 place-items-center rounded-[10px] bg-white text-[17px] font-black tracking-tight text-black", className)}>
      s<span className="text-s1-blue">1</span>
    </span>
  );
}

export function Avatar({ initials, photo, size = 40, className }: { initials: string; photo?: string | null; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center overflow-hidden rounded-full bg-s1-surface-3 font-semibold text-white", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {photo ? <img src={photo} alt="" className="size-full object-cover" /> : initials}
    </span>
  );
}

/** Top bar of a phone screen: back link or logo on the left, title in the middle, actions right. */
export function TopBar({ back, left, title, right, className }: { back?: { href: string; label: string }; left?: ReactNode; title?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <header className={cn("s1-glass sticky top-0 z-30 grid h-14 grid-cols-[minmax(84px,1fr)_auto_minmax(84px,1fr)] items-center px-2 pt-safe", className)}>
      <div className="flex min-w-0 items-center">
        {back ? (
          <Link href={back.href} className={btn({ variant: "plain", className: "-ml-1 gap-0.5 px-1.5 font-medium" })}>
            <ChevronLeft className="size-6" aria-hidden />
            <span className="max-w-[9.5rem] truncate">{back.label}</span>
          </Link>
        ) : (
          left
        )}
      </div>
      <div className="min-w-0 truncate text-center text-[17px] font-semibold">{title}</div>
      <div className="flex items-center justify-end gap-1">{right}</div>
    </header>
  );
}

export function PageTitle({ title, sub, className, children }: { title: ReactNode; sub?: ReactNode; className?: string; children?: ReactNode }) {
  return (
    <div className={cn("flex items-end justify-between gap-3 px-1", className)}>
      <div className="min-w-0">
        <h1 className="text-[32px] leading-10 font-bold tracking-[-0.022em] text-balance md:text-[34px]">{title}</h1>
        {sub ? <p className="mt-0.5 text-[15px] text-s1-muted">{sub}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between px-4", className)}>
      <h2 className="text-[13px] leading-[18px] font-semibold text-s1-muted">{children}</h2>
      {action}
    </div>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-[20px] bg-s1-surface-2", className)} {...props} />;
}

/** Grouped list (iOS style): rows separated by hairlines inside one rounded card. */
export function Group({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("overflow-hidden rounded-[20px] bg-s1-surface-2 [&>*+*]:border-t [&>*+*]:border-s1-hairline", className)} {...props} />;
}

type RowProps = {
  title: ReactNode;
  sub?: ReactNode;
  lead?: ReactNode;
  trail?: ReactNode;
  href?: string;
  chevron?: boolean;
  className?: string;
};

export function Row({ title, sub, lead, trail, href, chevron = !!href, className }: RowProps) {
  const body = (
    <>
      {lead}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[17px] leading-[22px] font-medium">{title}</div>
        {sub ? <div className="mt-0.5 text-[14px] leading-[19px] text-s1-muted">{sub}</div> : null}
      </div>
      {trail}
      {chevron ? <ChevronRight className="size-5 shrink-0 text-s1-faint" aria-hidden /> : null}
    </>
  );
  const cls = cn("flex min-h-[62px] items-center gap-3 px-4 py-2.5", href && "tap transition-colors hover:bg-white/[0.03] active:bg-s1-surface-3", className);
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Round icon disc for list rows. */
export function Disc({ children, tone = "default", className }: { children: ReactNode; tone?: "default" | "blue" | "pink" | "green" | "yellow" | "red"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full [&_svg]:size-5",
        tone === "default" && "bg-s1-surface-3 text-white",
        tone === "blue" && "bg-s1-blue-tint text-s1-blue",
        tone === "pink" && "bg-s1-pink-tint text-s1-pink",
        tone === "green" && "bg-s1-green-tint text-s1-green",
        tone === "yellow" && "bg-s1-yellow-tint text-s1-yellow",
        tone === "red" && "bg-s1-red-tint text-s1-red",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Pill({ children, tone = "default", className }: { children: ReactNode; tone?: "default" | "blue" | "pink" | "green" | "yellow" | "red"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold",
        tone === "default" && "bg-s1-surface-3 text-s1-muted",
        tone === "blue" && "bg-s1-blue-tint text-s1-blue",
        tone === "pink" && "bg-s1-pink-tint text-s1-pink",
        tone === "green" && "bg-s1-green-tint text-s1-green",
        tone === "yellow" && "bg-s1-yellow-tint text-s1-yellow",
        tone === "red" && "bg-s1-red-tint text-s1-red",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Stat({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-1 rounded-2xl bg-s1-surface-2 px-3.5 py-3", className)}>
      <span className="truncate text-[12px] font-medium text-s1-muted">{label}</span>
      <b className="num truncate text-[20px] leading-6 font-bold tracking-tight">{value}</b>
    </div>
  );
}

/** Text with a tone, for row parts ("Today's feedback not in" in yellow). */
export function Toned({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={cn(tone === "warn" && "text-s1-yellow", tone === "good" && "text-s1-green", tone === "muted" && "text-s1-faint")}>{children}</span>;
}

export function Empty({ icon, title, children, className }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-[20px] border border-dashed border-white/10 px-6 py-10 text-center", className)}>
      {icon ? <Disc className="mb-1">{icon}</Disc> : null}
      <p className="text-[17px] font-semibold">{title}</p>
      {children ? <div className="max-w-sm text-[15px] text-s1-muted">{children}</div> : null}
    </div>
  );
}

/** Sticky bottom area for the one primary action on a phone screen. */
export function Dock({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black via-black/90 to-transparent px-4 pt-8 pb-[max(1rem,env(safe-area-inset-bottom))]", className)}>
      <div className="pointer-events-auto mx-auto max-w-md">{children}</div>
    </div>
  );
}
