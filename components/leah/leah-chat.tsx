"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { ArrowUp, SquarePen, X } from "lucide-react";
import { copy, leah, LOCALE_LABEL, LOCALES, type Locale } from "@/content/leah/persona";
import { MAX_MESSAGE_CHARS } from "@/lib/leah/protocol";
import { useLeah } from "@/lib/leah/store";
import { cn } from "@/lib/utils";
import { LeahAvatar } from "./leah-avatar";
import { LeahMessageView } from "./leah-message";

// 40px visual, 44px hit area
const ICON_BUTTON =
  "tap relative grid size-10 place-items-center rounded-full text-text-secondary after:absolute after:-inset-0.5 after:content-[''] hover:text-white";

type TitleProps = { className?: string; children: ReactNode };

type Props = {
  /** rendered as the dialog title (Vaul's Title in the sheet, a plain h2 in the panel) */
  Title: ComponentType<TitleProps>;
  onClose: () => void;
  /** navigating to a page from the chat: the sheet closes so the page is visible */
  onNavigate: () => void;
  autoFocus?: boolean;
};

function LanguageSwitch({ locale, onChange, label }: { locale: Locale; onChange: (l: Locale) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-8 items-center rounded-full bg-surface-3 p-0.5">
      {LOCALES.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={LOCALE_LABEL[l].name}
            onClick={() => onChange(l)}
            // 44px hit area around a compact 28px pill
            className={cn(
              "tap relative h-7 min-w-8 rounded-full px-1.5 text-xs font-semibold after:absolute after:-inset-x-0.5 after:-inset-y-2 after:content-['']",
              active ? "bg-white text-black" : "text-text-secondary hover:text-white",
            )}
          >
            {LOCALE_LABEL[l].short}
          </button>
        );
      })}
    </div>
  );
}

function Composer({ locale, busy, onSend, autoFocus }: { locale: Locale; busy: boolean; onSend: (t: string) => void; autoFocus?: boolean }) {
  const t = copy[locale];
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !busy;

  // grow with the text, up to five lines
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const submit = () => {
    if (!canSend) return;
    onSend(value);
    setValue("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-end gap-1.5 rounded-[26px] bg-surface-2 p-1.5 pl-4 shadow-[inset_0_0_0_1px_var(--hairline-strong)] transition-shadow focus-within:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.5)]"
    >
      <label htmlFor="leah-input" className="sr-only">
        {t.placeholder}
      </label>
      <textarea
        id="leah-input"
        ref={ref}
        rows={1}
        value={value}
        maxLength={MAX_MESSAGE_CHARS}
        enterKeyHint="send"
        placeholder={t.placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        // 16px stops iOS zooming into the field
        className="no-scrollbar max-h-[132px] min-h-11 flex-1 resize-none bg-transparent py-[11px] text-base leading-[22px] text-white outline-none placeholder:text-text-tertiary focus-visible:outline-none"
      />
      <button
        type="submit"
        aria-label={t.send}
        disabled={!canSend}
        className={cn(
          "tap grid size-11 shrink-0 place-items-center rounded-full transition-colors",
          canSend ? "bg-red text-white hover:bg-red-hover" : "bg-surface-4 text-white/35",
        )}
      >
        <ArrowUp className="size-5" strokeWidth={2.25} />
      </button>
    </form>
  );
}

export function LeahChat({ Title, onClose, onNavigate, autoFocus }: Props) {
  const messages = useLeah((s) => s.messages);
  const locale = useLeah((s) => s.locale);
  const busy = useLeah((s) => s.busy);
  const send = useLeah((s) => s.send);
  const retry = useLeah((s) => s.retry);
  const reset = useLeah((s) => s.reset);
  const setLocale = useLeah((s) => s.setLocale);
  const t = copy[locale];

  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  // follow the conversation unless the visitor has scrolled up to read
  const last = messages.at(-1);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, last?.content, last?.status]);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  }, []);

  const onSend = (text: string) => {
    pinned.current = true;
    void send(text);
  };

  const empty = messages.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col" lang={locale}>
      <header className="flex shrink-0 items-center gap-2.5 border-b border-hairline py-3 pr-1.5 pl-4">
        <LeahAvatar size={40} online />
        <div className="min-w-0 flex-1">
          <Title className="truncate text-[15px] leading-5 font-semibold text-white">{leah.name}</Title>
          <p className="truncate text-xs leading-4 text-text-tertiary">{t.role}</p>
        </div>
        <LanguageSwitch locale={locale} onChange={(l) => setLocale(l)} label={t.language} />
        <div className="flex items-center">
          {!empty ? (
            <button type="button" onClick={reset} aria-label={t.newChat} title={t.newChat} className={ICON_BUTTON}>
              <SquarePen className="size-[19px]" />
            </button>
          ) : null}
          <button type="button" onClick={onClose} aria-label={t.close} className={ICON_BUTTON}>
            <X className="size-[22px]" />
          </button>
        </div>
      </header>

      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-vaul-no-drag>
        {empty ? (
          <div className="flex min-h-full flex-col justify-end px-5 pt-10 pb-6">
            <p className="text-statement text-[46px] text-white">{t.greeting}</p>
            <p className="mt-3 max-w-[30ch] text-[15px] leading-[1.5] text-text-secondary">{t.intro}</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {t.suggestions.map((s) => (
                <li key={s.label}>
                  <button
                    type="button"
                    onClick={() => onSend(s.prompt)}
                    className="tap glass h-11 rounded-full px-4 text-sm font-medium text-white hover:bg-white/10"
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol aria-live="polite" aria-relevant="additions text" className="space-y-5 px-4 pt-5 pb-4">
            {messages.map((m) => (
              <LeahMessageView key={m.id} message={m} locale={locale} onNavigate={onNavigate} onRetry={retry} />
            ))}
          </ol>
        )}
      </div>

      <div className="shrink-0 px-3 pt-2 pb-3">
        <Composer locale={locale} busy={busy} onSend={onSend} autoFocus={autoFocus} />
        <p className="mt-2 px-2 text-center text-[11px] leading-4 text-text-tertiary">{t.disclaimer}</p>
      </div>
    </div>
  );
}
