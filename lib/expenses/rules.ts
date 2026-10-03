import { addMonths, type ISODate } from "@/lib/membership/dates";

export const EXPENSE_CATEGORIES = {
  rent: "Rent",
  wages: "Wages",
  "cafe-stock": "Cafe stock",
  supplements: "Supplements & retail stock",
  equipment: "Equipment",
  maintenance: "Repairs & maintenance",
  utilities: "Electricity & water",
  marketing: "Marketing",
  software: "Software & fees",
  other: "Other",
} as const;

export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

export type ExpenseLike = { id: string; date: ISODate; amountSatang: number; category: string; recurring: string; endsOn: ISODate | null; description: string };

/**
 * Every cost that falls between from and to. Monthly costs (rent, software) repeat on the
 * same day each month from their first date until endsOn (or forever).
 */
export function expensesInRange(rows: ExpenseLike[], from: ISODate, to: ISODate): (ExpenseLike & { occurrence: ISODate })[] {
  const out: (ExpenseLike & { occurrence: ISODate })[] = [];
  for (const e of rows) {
    if (e.recurring !== "monthly") {
      if (e.date >= from && e.date <= to) out.push({ ...e, occurrence: e.date });
      continue;
    }
    for (let i = 0; i < 600; i++) {
      const d = addMonths(e.date, i);
      if (d > to || (e.endsOn && d > e.endsOn)) break;
      if (d >= from) out.push({ ...e, occurrence: d });
    }
  }
  return out.sort((a, b) => a.occurrence.localeCompare(b.occurrence));
}
