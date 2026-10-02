import { describe, expect, it } from "vitest";
import { parseCSV } from "@/lib/csv";
import { analyze, combineRows, detectKind, parseNumber, profileColumns } from "@/lib/reports/analyze";

const read = (csv: string) => {
  const [headers, ...rows] = parseCSV(csv);
  return { headers, rows };
};

const transactions = read(
  [
    "Transaction ID,Date,Client Name,Email,Description,Payment Method,Amount",
    "t1,03/08/2026 09:15,Nicha S,n@x.com,1 Month Membership,Card,\"2,200.00\"",
    "t2,15/08/2026 18:40,Tom B,t@x.com,Day Pass,Cash,250.00",
    "t3,02/09/2026 07:05,Nicha S,n@x.com,1 Month Membership,Card,\"2,200.00\"",
    "t4,20/09/2026 17:30,Ploy W,p@x.com,10 PT Sessions,Transfer,\"15,000.00\"",
    "t5,21/09/2026 17:45,Tom B,t@x.com,Day Pass,Cash,250.00",
  ].join("\n"),
);

const attendance = read(
  [
    "Member ID,Client Name,Class,Coach,Booking Date,Start Time,Status",
    "m1,Nicha S,Open Gym,Bella,01/09/2026,07:00,Attended",
    "m2,Tom B,Open Gym,Bella,01/09/2026,18:00,Attended",
    "m1,Nicha S,Strength,Aun,03/09/2026,07:00,Attended",
    "m3,Ploy W,Strength,Aun,08/09/2026,18:00,No show",
  ].join("\n"),
);

describe("column profiling", () => {
  it("recognises dates, money, ids and categories", () => {
    const cols = profileColumns(transactions.headers, transactions.rows);
    const type = (h: string) => cols.find((c) => c.header === h)!.type;
    expect(type("Date")).toBe("date");
    expect(type("Amount")).toBe("money");
    expect(type("Transaction ID")).toBe("id");
    expect(type("Payment Method")).toBe("category");
    expect(type("Email")).toBe("text");
  });
  it("parses money the way exports write it", () => {
    expect(parseNumber("2,200.00")).toBe(2200);
    expect(parseNumber("฿ 1,250")).toBe(1250);
    expect(parseNumber("(100.50)")).toBe(-100.5);
    expect(parseNumber("abc")).toBe(null);
  });
});

describe("report detection", () => {
  it("tells transactions, attendance and members apart", () => {
    const t = profileColumns(transactions.headers, transactions.rows);
    expect(detectKind(transactions.headers, t)).toBe("transactions");
    const a = profileColumns(attendance.headers, attendance.rows);
    expect(detectKind(attendance.headers, a)).toBe("attendance");
    const m = read("First Name,Last Name,Email,Phone,Membership\nA,B,a@b.co,0811111111,1 Month\nC,D,c@d.co,0822222222,3 Months");
    expect(detectKind(m.headers, profileColumns(m.headers, m.rows))).toBe("members");
  });
});

describe("analysis", () => {
  it("adds up revenue by month and by item", () => {
    const a = analyze(transactions.headers, transactions.rows);
    expect(a.kind).toBe("transactions");
    expect(a.kpis[0]).toEqual({ label: "Revenue", value: 19900, format: "thb" });
    expect(a.monthly).toEqual([
      { date: "2026-08-01", value: 2450, count: 2 },
      { date: "2026-09-01", value: 17450, count: 3 },
    ]);
    expect(a.groups[0]).toEqual({ label: "10 PT Sessions", value: 15000, count: 1 });
    expect(a.range).toEqual({ from: "2026-08-03", to: "2026-09-21" });
    expect(a.hours?.[17]).toBe(15250);
  });
  it("counts visits, members and busiest times for attendance", () => {
    const a = analyze(attendance.headers, attendance.rows);
    expect(a.kpis.map((k) => [k.label, k.value])).toEqual([
      ["Visits", 4],
      ["Unique members", 3],
      ["Visits per member", 4 / 3],
    ]);
    expect(a.groups.map((g) => g.label)).toEqual(["Open Gym", "Strength"]);
    expect(a.hours?.[7]).toBe(2);
  });
  it("lets the user pick what to chart", () => {
    const a = analyze(transactions.headers, transactions.rows, { valueCol: null, groupCol: 5 });
    expect(a.groups[0]).toEqual({ label: "Card", value: 2, count: 2 });
  });
  it("combines repeated exports without double counting", () => {
    const half = { headers: transactions.headers, rows: transactions.rows.slice(0, 3) };
    const rest = { headers: transactions.headers, rows: transactions.rows.slice(2) };
    expect(combineRows([half, rest]).rows).toHaveLength(5);
  });
});

describe("combining keeps genuine repeats inside one file", () => {
  it("only drops rows already seen in another file", () => {
    const h = ["Date", "Amount"];
    const a = { headers: h, rows: [["01/09/2026", "250"], ["01/09/2026", "250"]] };
    const b = { headers: h, rows: [["01/09/2026", "250"], ["02/09/2026", "250"]] };
    expect(combineRows([a, b]).rows).toHaveLength(3);
  });
});
