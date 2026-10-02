import { desc, eq } from "drizzle-orm";
import { parseCSV } from "@/lib/csv";
import type { DB } from "@/lib/db/client";
import { reportUploads } from "@/lib/db/schema";
import { ServiceError } from "@/lib/membership/service";
import { analyze, KIND_LABEL, type ReportKind } from "./analyze";

export const MAX_REPORT_ROWS = 50_000;

/** Save an uploaded report as-is; work out its type and date range for the list. */
export async function saveReport(db: DB, input: { csv: string; fileName?: string; name?: string; source?: string }) {
  const [headers = [], ...raw] = parseCSV(input.csv);
  if (headers.length < 2 || !raw.length) throw new ServiceError("That file has no rows to read. Upload the CSV export, not a PDF or Excel file.");
  if (raw.length > MAX_REPORT_ROWS) throw new ServiceError(`That report has ${raw.length.toLocaleString()} rows; the limit is ${MAX_REPORT_ROWS.toLocaleString()}. Export a shorter date range.`);
  const rows = raw.map((r) => headers.map((_, i) => (r[i] ?? "").trim()));
  const a = analyze(headers, rows);
  const base = (input.fileName ?? "Report").replace(/\.csv$/i, "").replace(/[_-]+/g, " ").trim();
  const [saved] = await db
    .insert(reportUploads)
    .values({
      source: input.source ?? "glofox",
      kind: a.kind,
      name: input.name?.trim() || base || KIND_LABEL[a.kind],
      fileName: input.fileName ?? null,
      headers,
      rows,
      rowCount: rows.length,
      dateFrom: a.range?.from ?? null,
      dateTo: a.range?.to ?? null,
    })
    .returning({ id: reportUploads.id });
  return saved.id;
}

export async function listReports(db: DB) {
  return db
    .select({
      id: reportUploads.id,
      source: reportUploads.source,
      kind: reportUploads.kind,
      name: reportUploads.name,
      fileName: reportUploads.fileName,
      rowCount: reportUploads.rowCount,
      dateFrom: reportUploads.dateFrom,
      dateTo: reportUploads.dateTo,
      uploadedAt: reportUploads.uploadedAt,
      headers: reportUploads.headers,
    })
    .from(reportUploads)
    .orderBy(desc(reportUploads.uploadedAt));
}

export async function getReport(db: DB, id: string) {
  const [r] = await db.select().from(reportUploads).where(eq(reportUploads.id, id)).limit(1);
  return r ?? null;
}

export async function updateReport(db: DB, id: string, patch: { kind?: ReportKind; name?: string }) {
  const set: { kind?: string; name?: string } = {};
  if (patch.kind && patch.kind in KIND_LABEL) set.kind = patch.kind;
  if (patch.name?.trim()) set.name = patch.name.trim().slice(0, 120);
  if (Object.keys(set).length) await db.update(reportUploads).set(set).where(eq(reportUploads.id, id));
}

export async function deleteReport(db: DB, id: string) {
  await db.delete(reportUploads).where(eq(reportUploads.id, id));
}
