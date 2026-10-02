import { LOCALES, type Locale } from "@/content/leah/persona";

export type ChatRole = "user" | "assistant";
export type ChatTurn = { role: ChatRole; content: string };
export type ChatRequest = { messages: ChatTurn[]; locale: Locale };

export const MAX_MESSAGE_CHARS = 1000;
/** turns sent to the model; older context is dropped */
export const MAX_HISTORY = 16;

export type ParseResult = { ok: true; value: ChatRequest } | { ok: false; error: string };

function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** Validate an untrusted request body and trim it to what the model needs. */
export function parseChatRequest(body: unknown): ParseResult {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid body" };
  const { messages, locale } = body as Record<string, unknown>;
  if (!Array.isArray(messages) || messages.length === 0) return { ok: false, error: "No messages" };

  const turns: ChatTurn[] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") return { ok: false, error: "Invalid message" };
    const { role, content } = m as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      return { ok: false, error: "Invalid message" };
    }
    const text = content.trim();
    if (!text) continue;
    if (role === "user" && text.length > MAX_MESSAGE_CHARS) return { ok: false, error: "Message too long" };
    turns.push({ role, content: role === "assistant" ? text.slice(0, 4000) : text });
  }

  const recent = turns.slice(-MAX_HISTORY);
  // the conversation must open with the visitor
  while (recent.length && recent[0].role !== "user") recent.shift();
  if (!recent.length || recent.at(-1)!.role !== "user") return { ok: false, error: "Last message must be from the user" };

  return { ok: true, value: { messages: recent, locale: isLocale(locale) ? locale : "en" } };
}

/** Newline-delimited JSON events streamed from /api/leah. */
export type StreamEvent =
  | { type: "delta"; text: string }
  /** discard text so far: a declined reply is being re-run on the fallback model */
  | { type: "reset" }
  | { type: "done" }
  | { type: "error"; message: string };

export function encodeEvent(event: StreamEvent) {
  return `${JSON.stringify(event)}\n`;
}
