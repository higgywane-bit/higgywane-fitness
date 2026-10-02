import Image from "next/image";
import { leah } from "@/content/leah/persona";
import { cn } from "@/lib/utils";

type Props = { size: number; online?: boolean; className?: string };

/** Leah's circular portrait, or a monogram until a photo is supplied. */
export function LeahAvatar({ size, online = false, className }: Props) {
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <span className="absolute inset-0 overflow-hidden rounded-full bg-[radial-gradient(120%_120%_at_30%_20%,#3a3a3a,#141414_60%,#000)] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)]">
        {leah.avatar ? (
          <Image src={leah.avatar} alt="" fill sizes={`${size}px`} className="object-cover" />
        ) : (
          <span
            aria-hidden
            className="text-statement grid size-full place-items-center pl-[0.04em] text-white"
            style={{ fontSize: size * 0.5 }}
          >
            L
          </span>
        )}
      </span>
      {online ? (
        <span
          aria-hidden
          className="absolute right-[2%] bottom-[2%] rounded-full bg-success ring-2 ring-black"
          style={{ width: Math.max(8, size * 0.24), height: Math.max(8, size * 0.24) }}
        />
      ) : null}
    </span>
  );
}
