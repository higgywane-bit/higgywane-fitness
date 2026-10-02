/** Small RFC 4180 CSV reader: quoted fields, escaped quotes, CRLF, BOM, and , ; or tab delimiters. */
export function parseCSV(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.indexOf("\n") === -1 ? undefined : src.indexOf("\n"));
  const delim = [",", ";", "\t"].reduce((best, d) => (count(firstLine, d) > count(firstLine, best) ? d : best), ",");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

function count(s: string, ch: string) {
  return s.split(ch).length - 1;
}

/** Header → field key, by comparing letters and digits only ("Membership Expiry Date" → "membershipexpirydate"). */
export function headerKey(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function autoMap<F extends string>(headers: string[], aliases: Record<F, string[]>): Partial<Record<F, number>> {
  const keys = headers.map(headerKey);
  const map: Partial<Record<F, number>> = {};
  const used = new Set<number>();
  for (const field of Object.keys(aliases) as F[]) {
    // exact alias wins; aliases are listed most-specific first
    for (const alias of aliases[field]) {
      const i = keys.findIndex((k, idx) => k === alias && !used.has(idx));
      if (i !== -1) {
        map[field] = i;
        used.add(i);
        break;
      }
    }
  }
  return map;
}

/**
 * Dates as exports write them: 2025-10-03, 03/10/2025 (day first unless told otherwise),
 * 3 Oct 2025, Oct 3, 2025, with or without a time, and Thai Buddhist-era years (2568 → 2025).
 */
export function parseLooseDate(raw: string, dayFirst = true): string | null {
  const s = raw.trim();
  if (!s) return null;
  const y = (n: number) => (n > 2400 ? n - 543 : n < 100 ? 2000 + n : n);
  const out = (yy: number, mm: number, dd: number) => {
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const d = new Date(Date.UTC(yy, mm - 1, dd));
    return d.getUTCMonth() === mm - 1 ? d.toISOString().slice(0, 10) : null;
  };
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return out(y(+m[1]), +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    let day = dayFirst ? +m[1] : +m[2];
    let month = dayFirst ? +m[2] : +m[1];
    if (month > 12 && day <= 12) [day, month] = [month, day];
    return out(y(+m[3]), month, day);
  }
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  m = s.match(/^(\d{1,2})\s+([a-z]{3})[a-z]*\.?,?\s+(\d{2,4})/i);
  if (m) return out(y(+m[3]), months.indexOf(m[2].toLowerCase()) + 1, +m[1]);
  m = s.match(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{2,4})/i);
  if (m) return out(y(+m[3]), months.indexOf(m[1].toLowerCase()) + 1, +m[2]);
  return null;
}

/** Write rows as CSV (Excel-friendly: BOM, quoted where needed, CRLF). */
export function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    // guard against spreadsheet formula injection
    const safe = /^[=+\-@]/.test(s) && !/^[+-]?[\d.,\s]+$/.test(s) ? `'${s}` : s;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return "﻿" + [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}
