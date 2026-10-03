"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronUp, CreditCard, Minus, Plus, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { ringUpAction, searchMembersAction } from "@/app/admin/actions";
import { AdminDialog, ErrorText } from "@/components/admin/kit";
import { MemberAvatar } from "@/components/admin/member-avatar";
import { standingLine } from "@/components/admin/member-row";
import { StatusBadge } from "@/components/admin/status-badge";
import { PaymentStep, type DeskPayMethod } from "@/components/admin/pay/payment-step";
import { DrinkArt } from "@/components/cafe/drink-art";
import { OptionGroupView } from "@/components/cafe/option-groups";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import type { Plan } from "@/content/plans";
import type { MenuItem, Selections } from "@/content/types";
import type { MemberListRow } from "@/lib/admin/queries";
import { getMenuItem, getPlan, menuCategories, menuItems } from "@/lib/catalog";
import { formatTHB } from "@/lib/format";
import { formatDate } from "@/lib/membership/dates";
import { defaultSelections, itemGroups, itemMacros, itemPrice, roundMacros, scaleMacros, selectionSummary, sumMacros, toggleOption } from "@/lib/nutrition";
import type { TillReceipt } from "@/lib/pos/service";
import { cn } from "@/lib/utils";

type Line =
  | { key: string; kind: "menu"; itemId: string; qty: number; selections: Selections; note?: string }
  | { key: string; kind: "plan"; planId: string };

const PLAN_TABS = [
  { id: "plans:membership", title: "Memberships" },
  { id: "plans:pt", title: "PT" },
];

const uid = () => Math.random().toString(36).slice(2, 10);

function isTypingTarget(el: EventTarget | null) {
  const e = el as HTMLElement | null;
  return !!e && (e.tagName === "INPUT" || e.tagName === "TEXTAREA" || e.tagName === "SELECT" || e.isContentEditable);
}

export function Till({ plans, promptPayId }: { plans: Plan[]; promptPayId: string | null }) {
  const categories = menuCategories().filter((c) => menuItems({ includeHidden: true }).some((m) => m.category === c.id));
  const [tab, setTab] = useState<string>(categories[0]?.id ?? "plans:membership");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [member, setMember] = useState<MemberListRow | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [method, setMethod] = useState<DeskPayMethod>("qashier");
  const [reference, setReference] = useState("");
  const [sendToBar, setSendToBar] = useState(true);
  const [configuring, setConfiguring] = useState<{ item: MenuItem; line?: Extract<Line, { kind: "menu" }> } | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [receipt, setReceipt] = useState<TillReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const total = lines.reduce((a, l) => a + lineAmount(l), 0);
  const count = lines.reduce((a, l) => a + (l.kind === "menu" ? l.qty : 1), 0);
  const hasPlan = lines.some((l) => l.kind === "plan");
  const hasCafe = lines.some((l) => l.kind === "menu" && getMenuItem(l.itemId)?.category !== "merchandise");
  const macros = roundMacros(sumMacros(lines.filter((l) => l.kind === "menu").map((l) => scaleMacros(itemMacros(getMenuItem(l.itemId)!, l.selections), l.qty))));

  const attach = useCallback(async (raw: string) => {
    const res = await searchMembersAction(raw);
    if (res.ok && res.data.length === 1) setMember(res.data[0]);
    else setError(res.ok && res.data.length === 0 ? `No member with code ${raw}.` : "More than one match. Search by name.");
  }, []);

  // A card scanned anywhere on the till attaches that member.
  useEffect(() => {
    let buffer = "";
    let last = 0;
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || configuring || receipt || e.metaKey || e.ctrlKey || e.altKey) return;
      const now = performance.now();
      if (now - last > 1500) buffer = "";
      last = now;
      if (e.key === "Enter") {
        if (buffer.length >= 3) void attach(buffer);
        buffer = "";
      } else if (e.key.length === 1) buffer += e.key;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [attach, configuring, receipt]);

  function addItem(item: MenuItem) {
    if (item.available === false) return;
    if (itemGroups(item).length === 0) return pushMenu(item, defaultSelections(item), 1);
    setConfiguring({ item });
  }

  function pushMenu(item: MenuItem, selections: Selections, qty: number, note?: string, replaceKey?: string) {
    setError(null);
    setLines((ls) => {
      if (replaceKey) return ls.map((l) => (l.key === replaceKey ? { key: replaceKey, kind: "menu", itemId: item.id, qty, selections, note } : l));
      const same = ls.find((l) => l.kind === "menu" && l.itemId === item.id && !note && !l.note && JSON.stringify(l.selections) === JSON.stringify(selections));
      if (same && same.kind === "menu") return ls.map((l) => (l === same ? { ...same, qty: same.qty + qty } : l));
      return [...ls, { key: uid(), kind: "menu", itemId: item.id, qty, selections, note }];
    });
  }

  function addPlan(p: Plan) {
    setError(null);
    setLines((ls) => [...ls, { key: uid(), kind: "plan", planId: p.id }]);
  }

  function setQty(key: string, d: number) {
    setLines((ls) => ls.flatMap((l) => (l.key !== key ? [l] : l.kind === "plan" ? (d < 0 ? [] : [l]) : l.qty + d <= 0 ? [] : [{ ...l, qty: l.qty + d }])));
  }

  function reset() {
    setLines([]);
    setMember(null);
    setCustomerName("");
    setReference("");
    setReceipt(null);
    setError(null);
    setTicketOpen(false);
  }

  function charge() {
    setError(null);
    start(async () => {
      const res = await ringUpAction({
        memberId: member?.id ?? null,
        customerName: customerName || null,
        paymentMethod: method,
        paymentRef: reference || null,
        sendToBar,
        lines: lines.map((l) => (l.kind === "plan" ? { kind: "plan", planId: l.planId } : { kind: "menu", itemId: l.itemId, qty: l.qty, selections: l.selections, note: l.note })),
      });
      if (!res.ok) return setError(res.error);
      setTicketOpen(false);
      setReceipt(res.data);
    });
  }

  const needle = query.trim().toLowerCase();
  const tiles = useMemo(() => {
    if (needle) return { items: menuItems({ includeHidden: true }).filter((m) => m.name.toLowerCase().includes(needle)), plans: plans.filter((p) => p.name.toLowerCase().includes(needle)) };
    if (tab.startsWith("plans:")) return { items: [], plans: plans.filter((p) => p.kind === tab.slice(6)) };
    return { items: menuItems({ includeHidden: true }).filter((m) => m.category === tab), plans: [] };
  }, [needle, tab, plans]);

  const ticket = (
    <Ticket
      lines={lines}
      member={member}
      onMember={setMember}
      onScan={attach}
      customerName={customerName}
      onCustomerName={setCustomerName}
      onQty={setQty}
      onEdit={(l) => setConfiguring({ item: getMenuItem(l.itemId)!, line: l })}
      total={total}
      macros={hasCafe ? macros : null}
      hasCafe={hasCafe}
      sendToBar={sendToBar}
      onSendToBar={setSendToBar}
      method={method}
      onMethod={setMethod}
      reference={reference}
      onReference={setReference}
      promptPayId={promptPayId}
      error={error ?? (hasPlan && !member ? "Add the member to sell a plan." : null)}
      canCharge={lines.length > 0 && (!hasPlan || !!member) && !pending}
      pending={pending}
      onCharge={charge}
      onClear={reset}
    />
  );

  return (
    <div className="grid min-h-[calc(100dvh-8rem)] lg:min-h-dvh lg:grid-cols-[minmax(0,1fr)_400px]">
      <section className="min-w-0 px-4 pt-4 pb-32 md:px-8 md:pt-6 lg:pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-statement text-[34px] md:text-[44px]">Till</h1>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-text-tertiary" aria-hidden />
            <Input aria-label="Search products and plans" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} className="h-12 pl-11" />
          </div>
        </div>

        {!needle ? (
          <div role="tablist" aria-label="Sections" className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
            {[...categories, ...PLAN_TABS].map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={tab === c.id}
                onClick={() => setTab(c.id)}
                className={cn("tap inline-flex h-11 shrink-0 items-center rounded-full px-5 text-sm font-semibold", tab === c.id ? "bg-white text-black" : "glass text-text-secondary hover:text-white")}
              >
                {c.title}
              </button>
            ))}
          </div>
        ) : null}

        <ul className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {tiles.items.map((m) => (
            <li key={m.id}>
              <ProductTile item={m} count={lines.reduce((a, l) => a + (l.kind === "menu" && l.itemId === m.id ? l.qty : 0), 0)} onAdd={() => addItem(m)} />
            </li>
          ))}
          {tiles.plans.map((p) => (
            <li key={p.id}>
              <PlanTile plan={p} onAdd={() => addPlan(p)} />
            </li>
          ))}
        </ul>
      </section>

      {/* ticket: side panel on large screens, bottom bar + sheet on phones and tablets */}
      <aside className="hidden border-l border-hairline bg-surface-1 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">{ticket}</aside>
      <div className="fixed inset-x-3 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+0.75rem)] z-30 lg:hidden">
        <button
          type="button"
          onClick={() => setTicketOpen(true)}
          className="tap flex h-16 w-full items-center gap-3 rounded-[22px] bg-white px-4 text-black shadow-[0_20px_60px_-10px_rgb(0_0_0/0.8)]"
        >
          <span className="grid size-10 place-items-center rounded-2xl bg-black text-white">
            <ShoppingBag className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-sm font-semibold">{count ? `${count} item${count === 1 ? "" : "s"}` : "Ticket empty"}</span>
            <span className="block truncate text-xs text-black/60">{member ? member.name : "Walk-in"}</span>
          </span>
          <span className="font-display tabular text-2xl">{formatTHB(total)}</span>
          <ChevronUp className="size-5" aria-hidden />
        </button>
      </div>
      <Drawer open={ticketOpen} onOpenChange={setTicketOpen} repositionInputs={false}>
        <DrawerContent className="h-[94dvh]">
          <DrawerTitle className="sr-only">Ticket</DrawerTitle>
          <DrawerDescription className="sr-only">Items, customer and payment</DrawerDescription>
          <div className="flex min-h-0 flex-1 flex-col" data-vaul-no-drag>
            {ticket}
          </div>
        </DrawerContent>
      </Drawer>

      {configuring ? (
        <Configure
          key={configuring.line?.key ?? configuring.item.id}
          item={configuring.item}
          line={configuring.line}
          onClose={() => setConfiguring(null)}
          onAdd={(sel, qty, note) => {
            pushMenu(configuring.item, sel, qty, note, configuring.line?.key);
            setConfiguring(null);
          }}
        />
      ) : null}

      <AnimatePresence>{receipt ? <Paid receipt={receipt} onDone={reset} /> : null}</AnimatePresence>
    </div>
  );
}

function lineAmount(l: Line): number {
  if (l.kind === "plan") return getPlan(l.planId)?.price ?? 0;
  const item = getMenuItem(l.itemId);
  return item ? itemPrice(item, l.selections) * l.qty : 0;
}

function ProductTile({ item, count, onAdd }: { item: MenuItem; count: number; onAdd: () => void }) {
  const soldOut = item.available === false;
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={soldOut}
      aria-label={`${item.name}, ${formatTHB(item.basePrice)}${soldOut ? ", sold out" : ""}`}
      className="tap group relative block w-full overflow-hidden rounded-[22px] text-left disabled:opacity-40"
    >
      <DrinkArt item={item} className="aspect-square w-full rounded-[22px] transition-transform duration-200 group-active:scale-[0.97]" sizes="(min-width: 1280px) 18vw, (min-width: 640px) 30vw, 46vw" />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-10">
        <span className="block truncate font-display text-xl leading-none uppercase">{item.name}</span>
        <span className="tabular mt-1 block text-sm font-semibold text-white/80">
          {item.priceIsFrom ? <span className="text-xs font-normal text-white/50">from </span> : null}
          {formatTHB(item.basePrice)}
        </span>
      </span>
      {soldOut ? <span className="absolute top-2 left-2 rounded-full bg-black/80 px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase">Sold out</span> : null}
      <AnimatePresence>
        {count ? (
          <motion.span
            key={count}
            initial={{ scale: 0.4 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 600, damping: 22 }}
            className="tabular absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-white text-sm font-bold text-black"
          >
            {count}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </button>
  );
}

function PlanTile({ plan, onAdd }: { plan: Plan; onAdd: () => void }) {
  const len = "months" in plan.duration ? `${plan.duration.months} month${plan.duration.months === 1 ? "" : "s"}` : `${plan.duration.days} day${plan.duration.days === 1 ? "" : "s"}`;
  return (
    <button type="button" onClick={onAdd} className="tap flex aspect-square w-full flex-col justify-between rounded-[22px] border border-hairline bg-[linear-gradient(160deg,#1c1c1c,#0b0b0b)] p-4 text-left hover:border-hairline-strong active:scale-[0.98]">
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] font-bold tracking-[0.16em] text-text-tertiary uppercase">{plan.kind === "pt" ? "PT pack" : "Plan"}</span>
        {plan.badge ? <span className="shrink-0 rounded-full bg-red px-2 py-0.5 text-[10px] font-bold whitespace-nowrap uppercase">{plan.badge}</span> : null}
      </span>
      <span>
        <span className="block font-display text-[28px] leading-[0.9] uppercase">{plan.name}</span>
        <span className="tabular mt-2 block text-lg font-semibold">{formatTHB(plan.price)}</span>
        <span className="block text-xs text-text-tertiary">{plan.kind === "pt" ? `${plan.sessions} sessions · valid ${len}` : len}</span>
      </span>
    </button>
  );
}

function Configure({
  item,
  line,
  onClose,
  onAdd,
}: {
  item: MenuItem;
  line?: Extract<Line, { kind: "menu" }>;
  onClose: () => void;
  onAdd: (sel: Selections, qty: number, note?: string) => void;
}) {
  const [sel, setSel] = useState<Selections>(line?.selections ?? defaultSelections(item));
  const [qty, setQty] = useState(line?.qty ?? 1);
  const [note, setNote] = useState(line?.note ?? "");
  const price = itemPrice(item, sel);
  const m = roundMacros(itemMacros(item, sel));
  return (
    <AdminDialog open onOpenChange={(o) => !o && onClose()} title={item.name} description={`${m.kcal} kcal · ${m.protein} g protein`} className="sm:max-w-lg">
      <div className="space-y-6">
        {itemGroups(item).map((g) => (
          <OptionGroupView key={g.id} item={item} group={g} selections={sel} onToggle={(gid, oid) => setSel((s) => toggleOption(item, s, gid, oid))} />
        ))}
        <Input aria-label="Note for the bar" placeholder="Note for the bar (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} />
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-full bg-surface-2">
            <Button type="button" variant="ghost" size="icon" aria-label="One less" onClick={() => setQty((q) => Math.max(1, q - 1))}>
              <Minus className="size-4" />
            </Button>
            <span className="tabular w-8 text-center text-lg font-semibold">{qty}</span>
            <Button type="button" variant="ghost" size="icon" aria-label="One more" onClick={() => setQty((q) => Math.min(50, q + 1))}>
              <Plus className="size-4" />
            </Button>
          </div>
          <Button size="lg" className="flex-1" onClick={() => onAdd(sel, qty, note.trim() || undefined)}>
            {line ? "Update" : "Add"} · {formatTHB(price * qty)}
          </Button>
        </div>
      </div>
    </AdminDialog>
  );
}

function Ticket(props: {
  lines: Line[];
  member: MemberListRow | null;
  onMember: (m: MemberListRow | null) => void;
  onScan: (code: string) => void;
  customerName: string;
  onCustomerName: (v: string) => void;
  onQty: (key: string, d: number) => void;
  onEdit: (l: Extract<Line, { kind: "menu" }>) => void;
  total: number;
  macros: { kcal: number; protein: number } | null;
  hasCafe: boolean;
  sendToBar: boolean;
  onSendToBar: (v: boolean) => void;
  method: DeskPayMethod;
  onMethod: (m: DeskPayMethod) => void;
  reference: string;
  onReference: (v: string) => void;
  promptPayId: string | null;
  error: string | null;
  canCharge: boolean;
  pending: boolean;
  onCharge: () => void;
  onClear: () => void;
}) {
  const { lines, member } = props;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-5 pt-5">
        <h2 className="font-display text-2xl uppercase">Ticket</h2>
        {lines.length || member ? (
          <Button variant="ghost" size="sm" onClick={props.onClear}>
            Clear
          </Button>
        ) : null}
      </div>

      <div className="px-5 pt-3">
        <CustomerPicker member={member} onMember={props.onMember} onScan={props.onScan} />
        {!member && props.hasCafe ? (
          <Input aria-label="Name for the order" placeholder="Name for the order (optional)" value={props.customerName} onChange={(e) => props.onCustomerName(e.target.value)} className="mt-2 h-11" />
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3">
        {lines.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-tertiary">Tap products or plans to add them.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            <AnimatePresence initial={false}>
              {lines.map((l) => {
                const item = l.kind === "menu" ? getMenuItem(l.itemId) : null;
                const plan = l.kind === "plan" ? getPlan(l.planId) : null;
                const summary = item && l.kind === "menu" ? selectionSummary(item, l.selections) : plan ? [plan.kind === "pt" ? `${plan.sessions} PT sessions` : "Membership"] : [];
                return (
                  <motion.li
                    key={l.key}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-start gap-3 py-3">
                      <button type="button" disabled={l.kind !== "menu"} onClick={() => l.kind === "menu" && props.onEdit(l)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate font-semibold">{item?.name ?? plan?.name}</span>
                        {summary.length ? <span className="block text-xs leading-snug text-text-tertiary">{summary.join(" · ")}</span> : null}
                        {l.kind === "menu" && l.note ? <span className="block text-xs text-energy">“{l.note}”</span> : null}
                      </button>
                      <div className="flex items-center rounded-full bg-surface-2">
                        <button type="button" aria-label="One less" onClick={() => props.onQty(l.key, -1)} className="tap grid size-9 place-items-center rounded-full hover:bg-surface-3">
                          {l.kind === "plan" || l.qty === 1 ? <X className="size-4" /> : <Minus className="size-4" />}
                        </button>
                        <span className="tabular w-6 text-center text-sm font-semibold">{l.kind === "menu" ? l.qty : 1}</span>
                        <button type="button" aria-label="One more" disabled={l.kind === "plan"} onClick={() => props.onQty(l.key, 1)} className="tap grid size-9 place-items-center rounded-full hover:bg-surface-3 disabled:opacity-30">
                          <Plus className="size-4" />
                        </button>
                      </div>
                      <span className="tabular w-16 pt-1.5 text-right text-sm font-semibold">{formatTHB(lineAmount(l))}</span>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t border-hairline px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-text-tertiary">Total</p>
            {props.macros ? (
              <p className="tabular text-xs text-text-tertiary">
                {props.macros.kcal} kcal · <span className="text-red-text">{props.macros.protein} g protein</span>
              </p>
            ) : null}
          </div>
          <p className="font-display tabular text-[44px] leading-none">{formatTHB(props.total)}</p>
        </div>
        {props.hasCafe ? (
          <button type="button" role="switch" aria-checked={props.sendToBar} onClick={() => props.onSendToBar(!props.sendToBar)} className="tap flex w-full items-center justify-between text-sm">
            <span className="text-text-secondary">Send drinks & food to the bar</span>
            <span className={cn("relative h-6 w-10 rounded-full transition-colors", props.sendToBar ? "bg-success" : "bg-surface-4")}>
              <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform", props.sendToBar && "translate-x-4")} />
            </span>
          </button>
        ) : null}
        {props.lines.length ? (
          <PaymentStep amount={props.total} method={props.method} onMethod={props.onMethod} reference={props.reference} onReference={props.onReference} promptPayId={props.promptPayId} />
        ) : null}
        <ErrorText error={props.error} />
        <Button size="lg" className="h-16 w-full text-lg" disabled={!props.canCharge} onClick={props.onCharge}>
          <CreditCard className="size-5" aria-hidden />
          {props.pending ? "Saving…" : props.lines.length ? `Paid ${formatTHB(props.total)}` : "Add items"}
        </Button>
      </div>
    </div>
  );
}

function CustomerPicker({ member, onMember, onScan }: { member: MemberListRow | null; onMember: (m: MemberListRow | null) => void; onScan: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<MemberListRow[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) return setMatches([]);
    const t = setTimeout(async () => {
      const res = await searchMembersAction(s);
      if (res.ok) setMatches(res.data);
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  if (member)
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-2.5">
        <MemberAvatar name={member.name} className="size-10 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {member.name} <span className="tabular font-normal text-text-tertiary">#{member.memberNo}</span>
          </p>
          <p className="truncate text-xs text-text-secondary">{standingLine(member)}</p>
        </div>
        <StatusBadge status={member.status} />
        <Button variant="ghost" size="icon" aria-label="Remove member" onClick={() => onMember(null)}>
          <X className="size-4" />
        </Button>
      </div>
    );

  if (!open)
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="tap flex h-14 w-full items-center gap-3 rounded-2xl border border-dashed border-hairline-strong px-3 text-left text-sm text-text-secondary hover:text-white"
      >
        <UserRound className="size-5" aria-hidden />
        <span className="flex-1">Walk-in · scan card or add member</span>
        <Plus className="size-4" aria-hidden />
      </button>
    );

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-text-tertiary" aria-hidden />
      <Input
        ref={inputRef}
        aria-label="Find member"
        placeholder="Name, phone, #number or card"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && q.trim().length >= 3) {
            e.preventDefault();
            onScan(q.trim());
            setQ("");
            setOpen(false);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        onBlur={() => setTimeout(() => !q && setOpen(false), 150)}
        className="h-14 pl-11"
      />
      {matches.length ? (
        <ul role="listbox" className="absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-72 overflow-y-auto rounded-2xl border border-hairline-strong bg-surface-2 p-1.5 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)]">
          {matches.map((m) => (
            <li key={m.id} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => {
                  onMember(m);
                  setQ("");
                  setOpen(false);
                }}
                className="tap flex min-h-14 w-full items-center gap-3 rounded-xl px-2.5 text-left hover:bg-surface-3"
              >
                <MemberAvatar name={m.name} className="size-9 text-sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{m.name}</span>
                  <span className="block truncate text-xs text-text-secondary">{standingLine(m)}</span>
                </span>
                <StatusBadge status={m.status} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Paid({ receipt, onDone }: { receipt: TillReceipt; onDone: () => void }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    const t = setTimeout(onDone, 9000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <motion.div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-[#03170a] px-6 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="alertdialog"
      aria-label={`Paid ${formatTHB(receipt.total)}`}
    >
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_45%_at_50%_35%,rgb(52_199_89/0.5),transparent_70%)]" />
      <motion.span
        className="relative grid size-28 place-items-center rounded-full bg-success shadow-[0_0_80px_rgb(52_199_89/0.6)]"
        initial={reduce ? false : { scale: 0.4 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 20 }}
      >
        <Check className="size-14 text-[#02150a]" strokeWidth={3} aria-hidden />
      </motion.span>
      <div className="relative">
        <p className="text-sm font-bold tracking-[0.3em] text-[#7ff0a0] uppercase">Paid</p>
        <p className="font-display tabular mt-2 text-[clamp(72px,16vw,140px)] leading-none">{formatTHB(receipt.total)}</p>
        <p className="mt-3 text-white/70">
          {receipt.customer} · {receipt.number}
        </p>
      </div>
      <ul className="relative space-y-1 text-sm text-white/80">
        {receipt.orderNumber ? <li>Order sent to the bar</li> : null}
        {receipt.plans.map((p) => (
          <li key={p.name}>
            {p.name} active until {formatDate(p.endsOn)}
          </li>
        ))}
      </ul>
      <Button variant="inverse" size="lg" className="relative min-w-48" onClick={onDone} autoFocus>
        New sale
      </Button>
    </motion.div>
  );
}
