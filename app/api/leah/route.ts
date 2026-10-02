import Anthropic from "@anthropic-ai/sdk";
import { business } from "@/content/business";
import { LOCALE_LABEL, type Locale } from "@/content/leah/persona";
import { bangkokClock, describeStatus } from "@/lib/leah/hours";
import { SYSTEM_PROMPT } from "@/lib/leah/knowledge";
import { offlineReply } from "@/lib/leah/offline";
import { encodeEvent, parseChatRequest, type ChatTurn, type StreamEvent } from "@/lib/leah/protocol";
import { knowledge, rateLimited } from "@/lib/leah/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Override with LEAH_MODEL to trade quality for cost or latency. */
const MODEL = process.env.LEAH_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return (client ??= new Anthropic());
}

const REFUSED: Record<Locale, string> = {
  en: "I can only help with Superfit questions. Anything about training, the cafe or memberships?",
  th: "ลีอาช่วยได้เฉพาะเรื่องของ Superfit ค่ะ มีคำถามเรื่องการเทรน คาเฟ่ หรือสมาชิกไหมคะ",
  ru: "Я могу помочь только с вопросами о Superfit. Что-нибудь о тренировках, кафе или абонементах?",
};

/** Live facts that change per request. Sent as a trailing system message so the cached prefix stays intact. */
function liveContext(locale: Locale, now: Date) {
  return [
    `Current time in Bangkok: ${bangkokClock(now).label}.`,
    describeStatus("The gym", business.hours.gym, now),
    describeStatus("The cafe", business.hours.cafe, now),
    `The visitor's preferred language is ${LOCALE_LABEL[locale].name}.`,
  ].join(" ");
}

async function streamOffline(send: (e: StreamEvent) => void, turns: ChatTurn[], locale: Locale) {
  const reply = offlineReply(turns.at(-1)!.content, locale);
  // word-by-word so offline mode feels like the real thing
  for (const chunk of reply.match(/\S+\s*/g) ?? [reply]) {
    send({ type: "delta", text: chunk });
    await new Promise((r) => setTimeout(r, 14));
  }
}

async function streamClaude(
  api: Anthropic,
  send: (e: StreamEvent) => void,
  turns: ChatTurn[],
  locale: Locale,
  signal: AbortSignal,
) {
  const stream = api.beta.messages.stream(
    {
      model: MODEL,
      // chat replies are a few sentences; this is headroom, not a target
      max_tokens: 1024,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        { type: "text", text: SYSTEM_PROMPT },
        {
          type: "text",
          text: `<superfit_knowledge>\n${knowledge()}\n</superfit_knowledge>`,
          cache_control: { type: "ephemeral", ttl: "1h" },
        },
      ],
      messages: [...turns, { role: "system", content: liveContext(locale, new Date()) }],
    },
    { signal },
  );

  for await (const event of stream) {
    if (event.type === "content_block_start" && event.content_block.type === "fallback") {
      send({ type: "reset" });
    } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      send({ type: "delta", text: event.delta.text });
    }
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") {
    send({ type: "reset" });
    send({ type: "delta", text: REFUSED[locale] });
  }
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) {
    return Response.json({ error: "Too many messages. Try again in a few minutes." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = parseChatRequest(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const { messages, locale } = parsed.value;

  const encoder = new TextEncoder();
  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      let sentText = false;
      const send = (e: StreamEvent) => {
        if (e.type === "delta") sentText = true;
        controller.enqueue(encoder.encode(encodeEvent(e)));
      };
      try {
        const api = anthropic();
        if (api) await streamClaude(api, send, messages, locale, req.signal);
        else await streamOffline(send, messages, locale);
        send({ type: "done" });
      } catch (error) {
        if (req.signal.aborted) {
          // visitor closed the tab or started over: nothing to deliver
        } else if (!sentText) {
          // API unavailable before any text: answer from local data rather than fail
          console.error("[leah] Claude request failed, using offline reply", error);
          await streamOffline(send, messages, locale);
          send({ type: "done" });
        } else {
          console.error("[leah] stream interrupted", error);
          send({ type: "error", message: "interrupted" });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed by an abort
        }
      }
    },
  });

  return new Response(body$, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Leah-Source": anthropic() ? "claude" : "offline",
    },
  });
}
