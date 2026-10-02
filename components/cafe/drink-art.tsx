import Image from "next/image";
import type { MenuItem } from "@/content/types";
import { cn } from "@/lib/utils";

/*
 * Product visual. Uses `item.image` when photography exists; until then renders the drink
 * in its own colour so the grid still reads as food, not as empty boxes.
 * TODO: confirm with cafe (product photography for every item)
 */

type Props = {
  item: Pick<MenuItem, "slug" | "name" | "tint" | "vessel" | "image" | "category">;
  className?: string;
  /** larger, more detailed rendering for the product sheet hero */
  hero?: boolean;
  sizes?: string;
  priority?: boolean;
};

export function DrinkArt({ item, className, hero, sizes = "50vw", priority }: Props) {
  if (item.image) {
    return (
      <div className={cn("relative overflow-hidden bg-surface-3", className)}>
        <Image src={item.image} alt={item.name} fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
    );
  }

  const id = `d-${item.slug}${hero ? "-h" : ""}`;
  const tint = item.tint;
  const vessel = item.vessel ?? "glass";
  const blended = item.category === "smoothies";

  return (
    <div
      role="img"
      aria-label={item.name}
      className={cn("relative overflow-hidden bg-surface-2", className)}
      style={{
        backgroundImage: `radial-gradient(120% 90% at 50% 100%, ${tint}66 0%, ${tint}1f 45%, transparent 75%)`,
      }}
    >
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full" aria-hidden preserveAspectRatio="xMidYMax meet">
        <defs>
          <linearGradient id={`${id}-liquid`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={tint} stopOpacity="1" />
            <stop offset="1" stopColor={tint} stopOpacity="0.72" />
          </linearGradient>
          <linearGradient id={`${id}-shade`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#000" stopOpacity="0.35" />
            <stop offset="0.35" stopColor="#000" stopOpacity="0" />
            <stop offset="0.8" stopColor="#000" stopOpacity="0.1" />
            <stop offset="1" stopColor="#000" stopOpacity="0.45" />
          </linearGradient>
          <radialGradient id={`${id}-floor`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#000" stopOpacity="0.7" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="100" cy="184" rx="56" ry="7" fill={`url(#${id}-floor)`} />

        {vessel === "glass" ? (
          <g>
            {/* straw */}
            <path d="M116 18 L104 70" stroke="#f5f5f5" strokeWidth="6" strokeLinecap="round" />
            {/* liquid */}
            <path d="M64 62 L136 62 L128 172 Q127 180 119 180 L81 180 Q73 180 72 172 Z" fill={`url(#${id}-liquid)`} />
            <path d="M64 62 L136 62 L128 172 Q127 180 119 180 L81 180 Q73 180 72 172 Z" fill={`url(#${id}-shade)`} />
            {blended ? (
              <ellipse cx="100" cy="62" rx="36" ry="6" fill={tint} style={{ filter: "brightness(1.35)" }} />
            ) : (
              <g fill="#fff" fillOpacity="0.22">
                <rect x="78" y="70" width="18" height="16" rx="3" transform="rotate(-12 87 78)" />
                <rect x="102" y="80" width="17" height="15" rx="3" transform="rotate(14 110 87)" />
                <rect x="86" y="96" width="16" height="14" rx="3" transform="rotate(6 94 103)" />
              </g>
            )}
            {/* glass */}
            <path
              d="M58 40 L142 40 L130 172 Q129 184 117 184 L83 184 Q71 184 70 172 Z"
              fill="#fff"
              fillOpacity="0.04"
              stroke="#fff"
              strokeOpacity="0.32"
              strokeWidth="1.5"
            />
            <ellipse cx="100" cy="40" rx="42" ry="5" fill="none" stroke="#fff" strokeOpacity="0.32" strokeWidth="1.5" />
            <path d="M68 52 L77 170" stroke="#fff" strokeOpacity="0.22" strokeWidth="4" strokeLinecap="round" />
          </g>
        ) : vessel === "cup" ? (
          <g>
            <ellipse cx="100" cy="178" rx="62" ry="8" fill="#e9e9e9" />
            <ellipse cx="100" cy="176" rx="62" ry="7" fill="#f7f7f7" />
            <path d="M142 112 Q166 112 166 132 Q166 152 140 154" fill="none" stroke="#efefef" strokeWidth="9" />
            <path d="M52 96 L148 96 L142 156 Q140 172 122 172 L78 172 Q60 172 58 156 Z" fill="#f4f4f4" />
            <path d="M52 96 L148 96 L142 156 Q140 172 122 172 L78 172 Q60 172 58 156 Z" fill={`url(#${id}-shade)`} opacity="0.5" />
            <ellipse cx="100" cy="96" rx="48" ry="9" fill="#dcdcdc" />
            <ellipse cx="100" cy="97" rx="43" ry="7" fill={tint} />
            <path
              d="M100 92 C92 92 88 96 92 99 C95 101 105 101 108 99 C112 96 108 92 100 92 Z"
              fill="#fff"
              fillOpacity="0.75"
            />
          </g>
        ) : (
          <g>
            <ellipse cx="100" cy="178" rx="46" ry="7" fill="#e9e9e9" />
            <path d="M128 132 Q146 132 146 146 Q146 158 128 158" fill="none" stroke="#efefef" strokeWidth="7" />
            <path d="M68 122 L132 122 L128 160 Q126 174 112 174 L88 174 Q74 174 72 160 Z" fill="#f4f4f4" />
            <ellipse cx="100" cy="122" rx="32" ry="6" fill="#dcdcdc" />
            <ellipse cx="100" cy="123" rx="28" ry="4.5" fill={tint} />
            <ellipse cx="100" cy="122.5" rx="16" ry="2.2" fill="#b07a4f" fillOpacity="0.7" />
          </g>
        )}
      </svg>
    </div>
  );
}
