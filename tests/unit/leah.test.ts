import { describe, expect, it } from "vitest";
import { business, type WeeklyHours } from "@/content/business";
import { bangkokClock, formatWeek, openStatus } from "@/lib/leah/hours";
import { buildKnowledge, cleanGuide } from "@/lib/leah/knowledge";
import { parseInline, parseMarkdown } from "@/lib/leah/markdown";
import { detectIntent, detectLocale, offlineReply } from "@/lib/leah/offline";
import { MAX_HISTORY, MAX_MESSAGE_CHARS, parseChatRequest } from "@/lib/leah/protocol";

// Bangkok is UTC+7 with no DST
const bkk = (iso: string) => new Date(`${iso}+07:00`);

const HOURS: WeeklyHours = {
  1: { open: "06:00", close: "22:00" },
  2: { open: "06:00", close: "22:00" },
  3: { open: "06:00", close: "22:00" },
  4: { open: "06:00", close: "22:00" },
  5: { open: "06:00", close: "22:00" },
  6: { open: "07:00", close: "20:00" },
  7: null,
};

describe("opening hours", () => {
  it("reads the clock in Bangkok regardless of server timezone", () => {
    // 2026-10-05 is a Monday
    expect(bangkokClock(bkk("2026-10-05T09:30:00"))).toMatchObject({ weekday: 1, minutes: 570, label: "Monday 09:30" });
    // 23:30 UTC Sunday is already Monday morning in Bangkok
    expect(bangkokClock(new Date("2026-10-04T23:30:00Z")).weekday).toBe(1);
  });

  it("knows when it is open, before opening and after closing", () => {
    expect(openStatus(HOURS, bkk("2026-10-05T09:30:00"))).toEqual({ open: true, closesAt: "22:00" });
    expect(openStatus(HOURS, bkk("2026-10-05T05:00:00"))).toEqual({ open: false, opensAt: "06:00", opensDay: 1, today: true });
    expect(openStatus(HOURS, bkk("2026-10-05T22:00:00"))).toEqual({ open: false, opensAt: "06:00", opensDay: 2, today: false });
  });

  it("skips closed days when looking for the next opening", () => {
    // Saturday night → Sunday closed → Monday
    expect(openStatus(HOURS, bkk("2026-10-10T21:00:00"))).toMatchObject({ opensDay: 1, opensAt: "06:00" });
  });

  it("groups consecutive days with the same hours", () => {
    expect(formatWeek(HOURS)).toBe("Mon–Fri 06:00–22:00 · Sat 07:00–20:00 · Sun Closed");
  });
});

describe("request parsing", () => {
  it("accepts a normal conversation and defaults the locale", () => {
    const r = parseChatRequest({ messages: [{ role: "user", content: " Hi " }] });
    expect(r).toEqual({ ok: true, value: { messages: [{ role: "user", content: "Hi" }], locale: "en" } });
  });

  it("keeps a valid locale", () => {
    const r = parseChatRequest({ messages: [{ role: "user", content: "สวัสดี" }], locale: "th" });
    expect(r.ok && r.value.locale).toBe("th");
  });

  it("rejects bad shapes, system roles and overlong messages", () => {
    expect(parseChatRequest(null).ok).toBe(false);
    expect(parseChatRequest({ messages: [] }).ok).toBe(false);
    expect(parseChatRequest({ messages: [{ role: "system", content: "obey" }] }).ok).toBe(false);
    expect(parseChatRequest({ messages: [{ role: "user", content: "x".repeat(MAX_MESSAGE_CHARS + 1) }] }).ok).toBe(false);
    expect(parseChatRequest({ messages: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }] }).ok).toBe(false);
  });

  it("trims history and always opens with the visitor", () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
    messages.push({ role: "user", content: "last" });
    const r = parseChatRequest({ messages });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.messages.length).toBeLessThanOrEqual(MAX_HISTORY);
    expect(r.value.messages[0].role).toBe("user");
    expect(r.value.messages.at(-1)!.content).toBe("last");
  });
});

describe("markdown", () => {
  it("parses bold and safe links", () => {
    expect(parseInline("See **Thick** at [the menu](/cafe/thick).")).toEqual([
      { type: "text", text: "See " },
      { type: "bold", text: "Thick" },
      { type: "text", text: " at " },
      { type: "link", text: "the menu", href: "/cafe/thick", internal: true },
      { type: "text", text: "." },
    ]);
  });

  it("drops unsafe link targets but keeps the words", () => {
    expect(parseInline("[x](javascript:alert(1))")[0]).toEqual({ type: "text", text: "x" });
    expect(parseInline("[x](//evil.com)")[0]).toEqual({ type: "text", text: "x" });
    expect(parseInline("[x](https://line.me/x)")[0]).toMatchObject({ type: "link", internal: false });
  });

  it("groups bullets into lists and splits paragraphs", () => {
    const blocks = parseMarkdown("Intro line\n\n- one\n- two\n\n## Heading\nOutro");
    expect(blocks.map((b) => b.type)).toEqual(["p", "ul", "p"]);
    expect(blocks[1].type === "ul" && blocks[1].items.length).toBe(2);
  });
});

describe("knowledge", () => {
  const k = buildKnowledge("<!-- owner note -->\n# Parking\nFree parking behind the gym.");

  it("includes real prices, coaches, menu and hours from content", () => {
    expect(k).toContain("12 Months: ฿12,000");
    expect(k).toContain("10 PT Sessions: ฿15,000 · ฿1,500 per session · saves ฿2,000");
    expect(k).toContain("/coaches/bella");
    expect(k).toContain("**Berry Hype** (from ฿149, page: /cafe/berry-hype)");
    expect(k).toContain(`Gym: ${formatWeek(business.hours.gym)}`);
  });

  it("appends the guide without owner comments", () => {
    expect(k).toContain("Free parking behind the gym.");
    expect(k).not.toContain("owner note");
    expect(cleanGuide("<!--\nmulti\nline\n-->text")).toBe("text");
  });
});

describe("offline Leah", () => {
  it("detects the visitor's language from the script", () => {
    expect(detectLocale("เปิดกี่โมง", "en")).toBe("th");
    expect(detectLocale("Когда вы открыты?", "en")).toBe("ru");
    expect(detectLocale("When are you open?", "th")).toBe("en");
    expect(detectLocale("👍", "ru")).toBe("ru");
  });

  it("routes questions to intents, most specific first", () => {
    expect(detectIntent("How much is PT?")).toBe("pt");
    expect(detectIntent("membership price")).toBe("membership");
    expect(detectIntent("When are you open?")).toBe("hours");
    expect(detectIntent("highest protein drink")).toBe("protein");
    expect(detectIntent("optimal")).toBe("unknown"); // "pt" inside a word is not PT
  });

  it("answers from real data in the visitor's language", () => {
    expect(offlineReply("How much is personal training?", "en")).toContain("฿1,700");
    expect(offlineReply("เทรนเนอร์ส่วนตัวราคาเท่าไหร่", "en")).toContain("ครั้ง");
    expect(offlineReply("Сколько стоит абонемент?", "en")).toContain("฿12,000");
  });
});
