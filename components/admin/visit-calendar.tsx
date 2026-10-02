import { addDays, diffDays, formatDate, type ISODate } from "@/lib/membership/dates";
import { cn } from "@/lib/utils";

/** The last 18 weeks as a grid of days, Monday on top. Filled = trained that day. */
export function VisitCalendar({ days, today, weeks = 18 }: { days: ISODate[]; today: ISODate; weeks?: number }) {
  const visited = new Set(days);
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const start = addDays(today, -(weeks - 1) * 7 - weekday);
  const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  const count = days.filter((d) => diffDays(d, today) < weeks * 7).length;
  return (
    <div>
      <div className="no-scrollbar overflow-x-auto">
        <div className="flex min-w-max gap-[3px]" role="img" aria-label={`${count} training days in the last ${weeks} weeks`}>
          {cols.map((col, i) => (
            <div key={i} className="grid gap-[3px]">
              {col.map((d) => (
                <span
                  key={d}
                  title={d <= today ? `${formatDate(d, today)}${visited.has(d) ? " · trained" : ""}` : undefined}
                  className={cn("size-3.5 rounded-[4px] md:size-4", d > today ? "bg-transparent" : visited.has(d) ? "bg-red" : "bg-white/[0.06]")}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-text-tertiary">{count} training days in the last {weeks} weeks</p>
    </div>
  );
}
