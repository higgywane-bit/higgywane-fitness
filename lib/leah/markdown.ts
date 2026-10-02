/*
 * Minimal, safe Markdown for chat replies: paragraphs, bullet lists, **bold** and [links](/path).
 * Produces data, never HTML, so model output can't inject markup.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string; internal: boolean };

export type Block = { type: "p"; inlines: Inline[] } | { type: "ul"; items: Inline[][] };

const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function safeHref(href: string): { href: string; internal: boolean } | null {
  if (/^\/(?!\/)/.test(href)) return { href, internal: true };
  if (/^https:\/\//i.test(href)) return { href, internal: false };
  return null;
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) {
      out.push({ type: "bold", text: m[1] });
    } else {
      const safe = safeHref(m[3]);
      out.push(safe ? { type: "link", text: m[2], ...safe } : { type: "text", text: m[2] });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: "p", inlines: parseInline(para.join(" ")) });
    para = [];
  };
  for (const raw of src.replace(/\r/g, "").split("\n")) {
    // headings aren't wanted in a chat bubble: keep the words, drop the hashes
    const line = raw.replace(/^#{1,6}\s+/, "").trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    if (BULLET.test(line)) {
      flush();
      const item = parseInline(line.replace(BULLET, ""));
      const prev = blocks.at(-1);
      if (prev?.type === "ul") prev.items.push(item);
      else blocks.push({ type: "ul", items: [item] });
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}
