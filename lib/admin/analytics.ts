import { addDays, diffDays, localClock, localDate, type ISODate } from "@/lib/membership/dates";

/** Pure aggregations for the dashboard. Inputs are raw rows; everything is bucketed in gym time. */

export type DayPoint = { date: ISODate; value: number };

export function dailySeries(times: Date[], days: number, today: ISODate, weight?: (i: number) => number): DayPoint[] {
  const start = addDays(today, -(days - 1));
  const buckets = new Map<ISODate, number>();
  for (let i = 0; i < days; i++) buckets.set(addDays(start, i), 0);
  times.forEach((t, i) => {
    const d = localDate(t);
    if (buckets.has(d)) buckets.set(d, buckets.get(d)! + (weight ? weight(i) : 1));
  });
  return [...buckets].map(([date, value]) => ({ date, value }));
}

/** visits[weekday 0=Mon][hour] over the given window */
export function hourHeatmap(times: Date[], open: number, close: number): number[][] {
  const grid = Array.from({ length: 7 }, () => Array(close - open).fill(0) as number[]);
  for (const t of times) {
    const { hour, weekday } = localClock(t);
    if (hour >= open && hour < close) grid[weekday][hour - open]++;
  }
  return grid;
}

/** Change vs a previous value, as a whole percentage. Null when there is nothing to compare. */
export function pctChange(now: number, before: number): number | null {
  if (!before) return null;
  return Math.round(((now - before) / before) * 100);
}

/** Same stretch of last month: 1st → today's day-of-month (clamped). */
export function monthToDateRanges(today: ISODate) {
  const thisStart = `${today.slice(0, 8)}01`;
  const day = Number(today.slice(8, 10));
  const prevEnd = addDays(thisStart, -1);
  const prevStart = `${prevEnd.slice(0, 8)}01`;
  const prevSameDay = addDays(prevStart, Math.min(day, Number(prevEnd.slice(8, 10))) - 1);
  return { thisStart, thisEnd: today, prevStart, prevEnd: prevSameDay, daysIn: diffDays(thisStart, today) + 1 };
}

export function inRange(t: Date, from: ISODate, to: ISODate) {
  const d = localDate(t);
  return d >= from && d <= to;
}
