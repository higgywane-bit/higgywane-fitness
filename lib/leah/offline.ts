import { business } from "@/content/business";
import { coaches, specialties } from "@/content/coaches";
import type { Locale } from "@/content/leah/persona";
import { menu } from "@/content/menu";
import { formatTHB } from "@/lib/format";
import { itemDefaults } from "@/lib/nutrition";
import { memberships, ptPackages, lowestPerSession } from "@/lib/pricing";
import { formatWeek, openStatus } from "./hours";

/*
 * Offline Leah: keyword answers built from the same data, used when no
 * ANTHROPIC_API_KEY is configured (local dev, previews) or the API is unavailable.
 * TODO: confirm with owner (Thai and Russian wording)
 */

export type Intent = "hours" | "pt" | "membership" | "protein" | "coaches" | "menu" | "location" | "hello" | "unknown";

const KEYWORDS: Record<Exclude<Intent, "unknown">, string[]> = {
  hours: ["open", "close", "hour", "time", "today", "เปิด", "ปิด", "เวลา", "กี่โมง", "открыт", "закры", "час", "работ", "время"],
  pt: ["personal", "pt", "trainer", "coach session", "เทรนเนอร์", "ส่วนตัว", "พีที", "персональ", "тренер", "тренировк"],
  membership: ["member", "membership", "pass", "join", "price", "cost", "สมาชิก", "ราคา", "แพ็กเกจ", "абонемент", "членств", "цен", "стоим"],
  protein: ["protein", "macro", "shake", "smoothie", "โปรตีน", "สมูทตี้", "белок", "белк", "протеин", "смузи"],
  coaches: ["coach", "who", "bella", "nicha", "aun", "poom", "โค้ช", "коуч", "тренеры"],
  menu: ["menu", "cafe", "coffee", "drink", "juice", "food", "เมนู", "คาเฟ่", "กาแฟ", "เครื่องดื่ม", "меню", "кафе", "кофе", "напит"],
  location: ["where", "address", "location", "map", "line", "instagram", "contact", "ที่ไหน", "ที่อยู่", "ติดต่อ", "где", "адрес", "контакт"],
  hello: ["hi", "hello", "hey", "สวัสดี", "привет", "здравств"],
};

// most specific first: "PT price" is a PT question, not a membership one
const ORDER: Exclude<Intent, "unknown">[] = ["pt", "hours", "protein", "coaches", "location", "membership", "menu", "hello"];

export function detectLocale(text: string, fallback: Locale): Locale {
  if (/[฀-๿]/.test(text)) return "th";
  if (/[Ѐ-ӿ]/.test(text)) return "ru";
  if (/[a-z]/i.test(text)) return "en";
  return fallback;
}

export function detectIntent(text: string): Intent {
  const t = ` ${text.toLowerCase()} `;
  for (const intent of ORDER) {
    const hit = KEYWORDS[intent].some((k) => {
      // short latin keywords must be whole words ("pt", "hi"), everything else is a substring
      if (/^[a-z]{1,3}$/.test(k)) return new RegExp(`[^a-z]${k}[^a-z]`).test(t);
      return t.includes(k);
    });
    if (hit) return intent;
  }
  return "unknown";
}

function topProtein() {
  return menu
    .filter((m) => m.category === "smoothies")
    .map((m) => ({ item: m, macros: itemDefaults(m).macros }))
    .sort((a, b) => b.macros.protein - a.macros.protein)
    .slice(0, 3);
}

/** Let lines wrap only between day ranges, never inside "Sat–Sun 07:00–20:00". */
function unbreakable(week: string) {
  return week
    .split(" · ")
    .map((run) => run.replace(/ /g, "\u00a0").replace(/–/g, "\u2060–\u2060"))
    .join(" · ");
}

type Answers = Record<Intent, () => string>;

function answers(locale: Locale, now: Date): Answers {
  const gym = openStatus(business.hours.gym, now);
  const gymWeek = unbreakable(formatWeek(business.hours.gym));
  const cafeWeek = unbreakable(formatWeek(business.hours.cafe));
  const pts = ptPackages();
  const best = pts.at(-1)!;
  const members = memberships();
  const month = members.find((m) => m.name === "1 Month");
  const year = members.find((m) => m.name === "12 Months");
  const day = members.find((m) => m.name === "Day Pass");
  const protein = topProtein();
  const proteinList = protein
    .map(({ item, macros }) => `- [${item.name}](/cafe/${item.slug}) · ${Math.round(macros.protein)} g · ${formatTHB(item.basePrice)}`)
    .join("\n");
  const coachList = coaches
    .map((c) => `- [${c.name}](/coaches/${c.slug}) · ${c.specialties.slice(0, 2).map((s) => specialties[s].label).join(", ")}`)
    .join("\n");
  const line = `[LINE ${business.contact.line.handle}](${business.contact.line.url})`;

  if (locale === "th") {
    return {
      hours: () =>
        `${gym.open ? `ตอนนี้ยิมเปิดอยู่ค่ะ ปิด ${gym.closesAt} น.` : "ตอนนี้ยิมปิดอยู่ค่ะ"}\n\n- ยิม: ${gymWeek}\n- คาเฟ่: ${cafeWeek}`,
      pt: () =>
        `เทรนส่วนตัวเริ่มต้น **${formatTHB(pts[0].price)}** ต่อครั้งค่ะ แพ็ก ${best.sessions} ครั้งเหลือ **${formatTHB(best.perSession)}** ต่อครั้ง ประหยัด ${formatTHB(best.saving)}\n\nดูแพ็กเกจทั้งหมดได้ที่ [หน้าเทรน](/train) หรือเลือกโค้ชแล้วจองได้เลยที่ [หน้าโค้ช](/coaches) ค่ะ`,
      membership: () =>
        `มีตั้งแต่ Day Pass **${formatTHB(day?.price ?? 0)}** รายเดือน **${formatTHB(month?.price ?? 0)}** จนถึงรายปี **${formatTHB(year?.price ?? 0)}** (ประหยัด ${formatTHB(year?.saving ?? 0)}) ค่ะ\n\n[ดูแพ็กเกจสมาชิกทั้งหมด](/train)`,
      protein: () => `เมนูโปรตีนสูงสุดของเราค่ะ\n${proteinList}\n\nเพิ่มเวย์ได้อีกช็อตละ ฿40 ค่ะ`,
      coaches: () => `ทีมโค้ชของเรามี 4 คนค่ะ\n${coachList}`,
      menu: () => `คาเฟ่มีสมูทตี้โปรตีน น้ำผลไม้สด กาแฟ และอาหารโปรตีนสูง พร้อมแมโครทุกแก้วค่ะ [ดูเมนู](/cafe)`,
      location: () => `${business.address}\n\n[เปิดแผนที่](${business.mapsUrl}) · ${line}`,
      hello: () => "สวัสดีค่ะ มีอะไรให้ลีอาช่วยไหมคะ",
      unknown: () => `ลีอายังไม่มีข้อมูลเรื่องนี้ค่ะ ทักทีมงานทาง ${line} ได้เลยนะคะ`,
    };
  }
  if (locale === "ru") {
    return {
      hours: () =>
        `${gym.open ? `Зал сейчас открыт, до ${gym.closesAt}.` : "Зал сейчас закрыт."}\n\n- Зал: ${gymWeek}\n- Кафе: ${cafeWeek}`,
      pt: () =>
        `Персональная тренировка стоит **${formatTHB(pts[0].price)}**. В пакете из ${best.sessions} занятий — **${formatTHB(best.perSession)}** за занятие, экономия ${formatTHB(best.saving)}.\n\n[Все пакеты](/train) · [выбрать тренера](/coaches)`,
      membership: () =>
        `От разового посещения за **${formatTHB(day?.price ?? 0)}** и месяца за **${formatTHB(month?.price ?? 0)}** до года за **${formatTHB(year?.price ?? 0)}** (экономия ${formatTHB(year?.saving ?? 0)}).\n\n[Все абонементы](/train)`,
      protein: () => `Больше всего белка здесь:\n${proteinList}\n\nДополнительная порция протеина — ฿40.`,
      coaches: () => `В нашей команде четыре тренера:\n${coachList}`,
      menu: () => `В кафе протеиновые смузи, свежие соки, кофе и белковая еда, у каждого напитка указаны КБЖУ. [Открыть меню](/cafe)`,
      location: () => `${business.address}\n\n[Карта](${business.mapsUrl}) · ${line}`,
      hello: () => "Привет! Чем могу помочь?",
      unknown: () => `У меня пока нет этой информации. Напишите команде в ${line}.`,
    };
  }
  return {
    hours: () =>
      `${gym.open ? `We're open now, until ${gym.closesAt}.` : "The gym is closed right now."}\n\n- Gym: ${gymWeek}\n- Cafe: ${cafeWeek}`,
    pt: () =>
      `A single PT session is **${formatTHB(pts[0].price)}**. Packs bring it down to **${formatTHB(lowestPerSession())}** a session with ${best.sessions} sessions, saving ${formatTHB(best.saving)}.\n\n[See PT packages](/train) or [pick a coach](/coaches) and book straight from their page.`,
    membership: () =>
      `From a **${formatTHB(day?.price ?? 0)}** day pass and **${formatTHB(month?.price ?? 0)}** a month, up to **${formatTHB(year?.price ?? 0)}** for 12 months, which saves ${formatTHB(year?.saving ?? 0)}.\n\n[Compare memberships](/train)`,
    protein: () => `Our highest-protein smoothies:\n${proteinList}\n\nAdd an extra whey scoop for ฿40.`,
    coaches: () => `Meet the Supercoach team:\n${coachList}`,
    menu: () => `Protein smoothies, fresh juice, coffee and high-protein food, every drink with live macros. [Open the menu](/cafe)`,
    location: () => `${business.address}\n\n[Open in Maps](${business.mapsUrl}) · ${line}`,
    hello: () => "Hi! What can I help you with?",
    unknown: () => `I don't have that detail yet. The team can help on ${line}.`,
  };
}

export function offlineReply(text: string, preferred: Locale, now = new Date()): string {
  const locale = detectLocale(text, preferred);
  return answers(locale, now)[detectIntent(text)]();
}
