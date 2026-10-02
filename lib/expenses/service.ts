import { desc, eq } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { expenses } from "@/lib/db/schema";
import { isISODate } from "@/lib/membership/dates";
import { logActivity, ServiceError } from "@/lib/membership/service";
import { currentActor } from "@/lib/staff/context";
import { EXPENSE_CATEGORIES } from "./rules";

export type ExpenseInput = {
  date: string;
  category: string;
  description: string;
  vendor?: string | null;
  amount: number;
  recurring?: "none" | "monthly";
  endsOn?: string | null;
  paymentMethod?: string | null;
};

export async function addExpense(db: DB, input: ExpenseInput) {
  if (!isISODate(input.date)) throw new ServiceError("Pick a date.");
  if (!(input.category in EXPENSE_CATEGORIES)) throw new ServiceError("Pick a category.");
  if (!input.description?.trim()) throw new ServiceError("Say what it was for.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new ServiceError("Amount must be more than zero.");
  if (input.endsOn && (!isISODate(input.endsOn) || input.endsOn < input.date)) throw new ServiceError("End date must be after the first date.");
  const [row] = await db
    .insert(expenses)
    .values({
      date: input.date,
      category: input.category,
      description: input.description.trim().slice(0, 200),
      vendor: input.vendor?.trim() || null,
      amountSatang: Math.round(input.amount * 100),
      recurring: input.recurring === "monthly" ? "monthly" : "none",
      endsOn: input.recurring === "monthly" ? input.endsOn || null : null,
      paymentMethod: input.paymentMethod?.trim() || null,
      staffId: currentActor(),
    })
    .returning();
  await logActivity(db, null, "expense.added", `Expense: ${row.description} ฿${(row.amountSatang / 100).toLocaleString("en-US")}${row.recurring === "monthly" ? " monthly" : ""}`);
  return row;
}

export async function endRecurring(db: DB, id: string, endsOn: string) {
  if (!isISODate(endsOn)) throw new ServiceError("Pick a date.");
  await db.update(expenses).set({ endsOn }).where(eq(expenses.id, id));
}

export async function deleteExpense(db: DB, id: string) {
  const [row] = await db.delete(expenses).where(eq(expenses.id, id)).returning();
  if (row) await logActivity(db, null, "expense.deleted", `Expense removed: ${row.description}`);
}

export async function allExpenses(db: DB) {
  return db.select().from(expenses).orderBy(desc(expenses.date));
}
