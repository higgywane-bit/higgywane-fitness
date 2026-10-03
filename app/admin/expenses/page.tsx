import Link from "next/link";
import { ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import { BarList } from "@/components/admin/charts";
import { AddExpenseButton, ExpenseRowActions } from "@/components/admin/expense-form";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { StatTile } from "@/components/admin/stat-tile";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { EXPENSE_CATEGORIES, expensesInRange } from "@/lib/expenses/rules";
import { allExpenses } from "@/lib/expenses/service";
import { formatTHB } from "@/lib/format";
import { addDays, addMonths, formatDate, localDate } from "@/lib/membership/dates";
import { pctChange } from "@/lib/performance/metrics";

export const metadata = { title: "Expenses" };

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  const today = localDate();
  const m = month && /^\d{4}-\d{2}$/.test(month) ? month : today.slice(0, 7);
  const from = `${m}-01`;
  const to = addDays(addMonths(from, 1), -1);
  const prevFrom = addMonths(from, -1);
  const rows = await allExpenses(await getDb());
  const list = expensesInRange(rows, from, to);
  const prev = expensesInRange(rows, prevFrom, addDays(from, -1));
  const total = list.reduce((a, e) => a + e.amountSatang, 0) / 100;
  const prevTotal = prev.reduce((a, e) => a + e.amountSatang, 0) / 100;
  const recurring = list.filter((e) => e.recurring === "monthly").reduce((a, e) => a + e.amountSatang, 0) / 100;
  const byCat = new Map<string, number>();
  for (const e of list) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amountSatang / 100);

  return (
    <div className="pb-12">
      <PageHeader eyebrow="Money out" title="Expenses">
        <Button asChild variant="ghost" size="icon" aria-label="Previous month">
          <Link href={`?month=${prevFrom.slice(0, 7)}`}>
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <span className="min-w-36 text-center text-sm font-semibold">{MONTH.format(new Date(`${from}T00:00:00Z`))}</span>
        <Button asChild variant="ghost" size="icon" aria-label="Next month">
          <Link href={`?month=${addMonths(from, 1).slice(0, 7)}`}>
            <ChevronRight className="size-5" />
          </Link>
        </Button>
        <AddExpenseButton />
      </PageHeader>
      <div className="space-y-3 px-4 md:space-y-4 md:px-8">
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          <StatTile label="Total this month" value={formatTHB(total)} change={pctChange(total, prevTotal)} lowerIsBetter sub="vs last month" />
          <StatTile label="Fixed monthly costs" value={formatTHB(recurring)} sub="Rent, wages, software…" />
          <StatTile label="One-off costs" value={formatTHB(total - recurring)} />
          <StatTile label="Biggest category" value={[...byCat].sort((a, b) => b[1] - a[1])[0] ? formatTHB([...byCat].sort((a, b) => b[1] - a[1])[0][1]) : "—"} sub={[...byCat].sort((a, b) => b[1] - a[1])[0] ? EXPENSE_CATEGORIES[[...byCat].sort((a, b) => b[1] - a[1])[0][0] as keyof typeof EXPENSE_CATEGORIES] : undefined} />
        </div>
        <div className="grid gap-3 md:gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Panel title={`${list.length} costs`}>
            {list.length ? (
              <div className="-mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-xs text-text-tertiary">
                    <tr>
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">What</th>
                      <th className="pb-2 font-medium">Category</th>
                      <th className="pb-2 text-right font-medium">Amount</th>
                      <th className="w-40 pb-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {list.map((e) => (
                      <tr key={`${e.id}${e.occurrence}`}>
                        <td className="py-2.5 pr-3 whitespace-nowrap text-text-secondary">{formatDate(e.occurrence, today)}</td>
                        <td className="py-2.5 pr-3">
                          <span className="font-medium">{e.description}</span>
                          {e.recurring === "monthly" ? (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs text-text-tertiary">
                              <Repeat className="size-3" aria-hidden />
                              monthly{e.endsOn ? ` until ${formatDate(e.endsOn, today)}` : ""}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2.5 pr-3 text-text-secondary">{EXPENSE_CATEGORIES[e.category as keyof typeof EXPENSE_CATEGORIES] ?? e.category}</td>
                        <td className="tabular py-2.5 text-right font-semibold">{formatTHB(e.amountSatang / 100)}</td>
                        <td className="py-1">
                          <ExpenseRowActions id={e.id} recurring={e.recurring === "monthly"} ended={!!e.endsOn} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-text-tertiary">No costs this month.</p>
            )}
          </Panel>
          <Panel title="By category">
            <BarList unit="thb" items={[...byCat].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: EXPENSE_CATEGORIES[k as keyof typeof EXPENSE_CATEGORIES] ?? k, value: v }))} />
            <p className="mt-5 text-xs text-text-tertiary">
              Profit and loss (sales minus these costs) is on <Link href="/admin/performance" className="underline underline-offset-4">Performance</Link>.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
