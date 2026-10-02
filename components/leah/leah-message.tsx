"use client";

import Link from "next/link";
import { memo, useMemo } from "react";
import { RotateCw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { Locale } from "@/content/leah/persona";
import { copy } from "@/content/leah/persona";
import { parseMarkdown, type Inline } from "@/lib/leah/markdown";
import type { LeahMessage } from "@/lib/leah/store";

type Props = {
  message: LeahMessage;
  locale: Locale;
  onNavigate: () => void;
  onRetry: () => void;
};

function Inlines({ inlines, onNavigate }: { inlines: Inline[]; onNavigate: () => void }) {
  return inlines.map((node, i) => {
    if (node.type === "bold") return <strong key={i} className="font-semibold text-white">{node.text}</strong>;
    if (node.type === "link") {
      const cls = "font-medium text-white underline decoration-white/35 underline-offset-[3px] hover:decoration-white";
      return node.internal ? (
        <Link key={i} href={node.href} onClick={onNavigate} className={cls}>
          {node.text}
        </Link>
      ) : (
        <a key={i} href={node.href} target="_blank" rel="noopener noreferrer" className={cls}>
          {node.text}
        </a>
      );
    }
    return <span key={i}>{node.text}</span>;
  });
}

function TypingDots({ label }: { label: string }) {
  return (
    <span role="status" aria-label={label} className="flex h-6 items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          className="size-1.5 animate-[leah-dot_1.1s_ease-in-out_infinite] rounded-full bg-white/70"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </span>
  );
}

export const LeahMessageView = memo(function LeahMessageView({ message, locale, onNavigate, onRetry }: Props) {
  const reduce = useReducedMotion();
  const t = copy[locale];
  const blocks = useMemo(() => parseMarkdown(message.content), [message.content]);

  const enter = reduce ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const } };

  if (message.role === "user") {
    return (
      <motion.li {...enter} className="flex justify-end pl-10">
        <p className="rounded-[22px] rounded-br-md bg-white px-4 py-2.5 text-[15px] leading-[1.45] break-words whitespace-pre-wrap text-black">
          {message.content}
        </p>
      </motion.li>
    );
  }

  return (
    <motion.li {...enter} className="pr-6">
      {message.content ? (
        <div className="space-y-2.5 text-[15px] leading-[1.55] break-words text-white/85">
          {blocks.map((b, i) =>
            b.type === "p" ? (
              <p key={i}>
                <Inlines inlines={b.inlines} onNavigate={onNavigate} />
              </p>
            ) : (
              <ul key={i} className="space-y-1.5">
                {b.items.map((item, j) => (
                  <li key={j} className="relative pl-4 before:absolute before:top-[0.7em] before:left-0.5 before:size-1 before:rounded-full before:bg-white/45">
                    <Inlines inlines={item} onNavigate={onNavigate} />
                  </li>
                ))}
              </ul>
            ),
          )}
        </div>
      ) : message.status === "streaming" ? (
        <TypingDots label={t.thinking} />
      ) : null}

      {message.status === "error" ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
          <span>{t.error}</span>
          <button type="button" onClick={onRetry} className="tap -mx-2 inline-flex h-11 items-center gap-1.5 rounded-full px-2 font-semibold text-white">
            <RotateCw className="size-3.5" aria-hidden />
            {t.retry}
          </button>
        </div>
      ) : null}

    </motion.li>
  );
});
