/*
 * Leah: Superfit's customer service assistant.
 * UI copy lives here so the chat components only render it.
 * TODO: confirm with owner (Leah's photo, Thai and Russian wording)
 */

export const LOCALES = ["en", "th", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABEL: Record<Locale, { short: string; name: string }> = {
  en: { short: "EN", name: "English" },
  th: { short: "ไทย", name: "ภาษาไทย" },
  ru: { short: "RU", name: "Русский" },
};

export const leah = {
  name: "Leah",
  /** square portrait in /public; null renders the monogram. TODO: confirm with owner */
  avatar: null as string | null,
};

export type Suggestion = { label: string; prompt: string };

type Copy = {
  role: string;
  status: string;
  greeting: string;
  intro: string;
  placeholder: string;
  send: string;
  open: string;
  close: string;
  language: string;
  thinking: string;
  error: string;
  retry: string;
  hidden: string;
  undo: string;
  dragHint: string;
  dismissTarget: string;
  hide: string;
  newChat: string;
  disclaimer: string;
  suggestions: Suggestion[];
};

export const copy: Record<Locale, Copy> = {
  en: {
    role: "Customer service",
    status: "Online · replies instantly",
    greeting: "Hi, I'm Leah.",
    intro: "Ask me anything about training, the cafe, memberships or opening hours.",
    placeholder: "Message Leah",
    send: "Send",
    open: "Chat with Leah",
    close: "Close chat",
    language: "Language",
    thinking: "Leah is typing",
    error: "Couldn't reach Leah. Check your connection.",
    retry: "Try again",
    hidden: "Leah is hidden for this visit",
    undo: "Undo",
    dragHint: "Drag here to hide",
    dismissTarget: "Hide Leah for this visit",
    hide: "Hide chat bubble",
    newChat: "New chat",
    disclaimer: "Leah can make mistakes. Prices on the site are final.",
    suggestions: [
      { label: "Personal training", prompt: "How does personal training work and what does it cost?" },
      { label: "Opening hours", prompt: "When are you open?" },
      { label: "Memberships", prompt: "What memberships do you have?" },
      { label: "High-protein drinks", prompt: "What's your highest-protein drink?" },
    ],
  },
  th: {
    role: "ฝ่ายบริการลูกค้า",
    status: "ออนไลน์ · ตอบทันที",
    greeting: "สวัสดีค่ะ ลีอาเองค่ะ",
    intro: "ถามได้ทุกเรื่อง ทั้งการเทรน คาเฟ่ สมาชิก และเวลาเปิดปิด",
    placeholder: "พิมพ์ข้อความถึงลีอา",
    send: "ส่ง",
    open: "แชทกับลีอา",
    close: "ปิดแชท",
    language: "ภาษา",
    thinking: "ลีอากำลังพิมพ์",
    error: "เชื่อมต่อไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง",
    retry: "ลองอีกครั้ง",
    hidden: "ซ่อนลีอาสำหรับการเข้าชมครั้งนี้แล้ว",
    undo: "เลิกทำ",
    dragHint: "ลากมาที่นี่เพื่อซ่อน",
    dismissTarget: "ซ่อนลีอาสำหรับการเข้าชมครั้งนี้",
    hide: "ซ่อนปุ่มแชท",
    newChat: "เริ่มแชทใหม่",
    disclaimer: "ลีอาอาจตอบผิดได้ ยึดราคาบนเว็บไซต์เป็นหลัก",
    suggestions: [
      { label: "เทรนเนอร์ส่วนตัว", prompt: "เทรนกับเทรนเนอร์ส่วนตัวเป็นยังไง ราคาเท่าไหร่คะ" },
      { label: "เวลาเปิดปิด", prompt: "เปิดกี่โมงถึงกี่โมงคะ" },
      { label: "สมาชิก", prompt: "มีแพ็กเกจสมาชิกแบบไหนบ้างคะ" },
      { label: "เครื่องดื่มโปรตีนสูง", prompt: "เมนูไหนโปรตีนสูงที่สุดคะ" },
    ],
  },
  ru: {
    role: "Служба поддержки",
    status: "Онлайн · отвечает сразу",
    greeting: "Привет, я Лия.",
    intro: "Спросите о тренировках, кафе, абонементах или часах работы.",
    placeholder: "Написать Лии",
    send: "Отправить",
    open: "Чат с Лией",
    close: "Закрыть чат",
    language: "Язык",
    thinking: "Лия печатает",
    error: "Не удалось связаться с Лией. Проверьте подключение.",
    retry: "Повторить",
    hidden: "Лия скрыта до конца визита",
    undo: "Вернуть",
    dragHint: "Перетащите сюда, чтобы скрыть",
    dismissTarget: "Скрыть Лию до конца визита",
    hide: "Скрыть кнопку чата",
    newChat: "Новый чат",
    disclaimer: "Лия может ошибаться. Точные цены — на сайте.",
    suggestions: [
      { label: "Персональные тренировки", prompt: "Как проходят персональные тренировки и сколько они стоят?" },
      { label: "Часы работы", prompt: "Когда вы открыты?" },
      { label: "Абонементы", prompt: "Какие абонементы у вас есть?" },
      { label: "Белковые напитки", prompt: "Какой напиток с самым высоким содержанием белка?" },
    ],
  },
};
