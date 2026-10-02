import { PLANS, type Plan } from "@/content/plans";
import { autoMap, parseLooseDate } from "@/lib/csv";
import { normalizeCode } from "./codes";
import { addDays, addMonths, type ISODate } from "./dates";

/*
 * Glofox → Superfit migration. Glofox's client download (Manage → Clients → Actions →
 * Download) is a CSV; column names vary by account and export version, so we match
 * headers loosely and let staff fix the mapping before anything is written.
 */

export const IMPORT_FIELDS = {
  firstName: "First name",
  lastName: "Last name",
  fullName: "Full name",
  email: "Email",
  phone: "Phone",
  birthDate: "Date of birth",
  gender: "Gender",
  externalId: "Glofox member ID",
  cardCode: "Card / barcode",
  planName: "Membership",
  startsOn: "Membership start",
  expiresOn: "Membership expiry",
  sessionsLeft: "Credits / sessions left",
  notes: "Notes",
} as const;

export type ImportField = keyof typeof IMPORT_FIELDS;
export type ImportMapping = Partial<Record<ImportField, number>>;

const ALIASES: Record<ImportField, string[]> = {
  firstName: ["firstname", "first", "givenname", "forename"],
  lastName: ["lastname", "surname", "familyname", "last"],
  fullName: ["fullname", "name", "clientname", "membername", "customername"],
  email: ["email", "emailaddress", "mail"],
  phone: ["phone", "phonenumber", "mobile", "mobilenumber", "telephone", "contactnumber", "tel"],
  birthDate: ["dateofbirth", "dob", "birthday", "birthdate"],
  gender: ["gender", "sex"],
  externalId: ["memberid", "clientid", "userid", "glofoxid", "id"],
  cardCode: ["barcode", "accessbarcode", "cardnumber", "card", "accesscode", "keyfob", "fob", "rfid", "accessid", "membernumber"],
  planName: ["membershipname", "membership", "currentmembership", "membershiptype", "plan", "planname"],
  startsOn: ["membershipstartdate", "membershipstart", "startdate", "start"],
  expiresOn: ["membershipexpirydate", "membershipexpiry", "expirydate", "expiry", "membershipenddate", "enddate", "expires", "expirationdate", "expiresat"],
  sessionsLeft: ["creditsremaining", "credits", "remainingcredits", "sessionsleft", "sessionsremaining"],
  notes: ["notes", "comments", "comment", "note"],
};

export function guessMapping(headers: string[]): ImportMapping {
  return autoMap(headers, ALIASES);
}

/** "3 Months Unlimited" → 3-months, "Annual" → 12-months, "10 PT Pack" → pt-10. Null when unsure. */
export function matchPlan(raw: string | undefined): Plan | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  const n = Number(s.match(/(\d+)/)?.[1] ?? NaN);
  const find = (id: string) => PLANS.find((p) => p.id === id) ?? null;
  if (/\b(pt|personal)/.test(s)) return find(`pt-${Number.isFinite(n) ? n : 1}`);
  if (/day|drop.?in|casual/.test(s)) return find("day-pass");
  if (/annual|year|12\s*m/.test(s)) return find("12-months");
  if (/week|wk/.test(s)) return find(`${Number.isFinite(n) ? n : 1}-week${n > 1 ? "s" : ""}`);
  if (/month|mth|\bmo\b/.test(s)) return find(`${Number.isFinite(n) ? n : 1}-month${n > 1 ? "s" : ""}`);
  return null;
}

export type ImportDraft = {
  row: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  gender: string | null;
  externalId: string | null;
  cardCode: string | null;
  notes: string | null;
  membership: null | {
    planId: string;
    planName: string;
    kind: "membership" | "pt";
    startsOn: ISODate;
    endsOn: ISODate;
    sessionsTotal: number | null;
    /** we only knew the expiry, so the start date is estimated */
    startEstimated: boolean;
  };
  warnings: string[];
};

export type DraftResult = { ok: true; draft: ImportDraft } | { ok: false; row: number; error: string };

export function buildDraft(cells: string[], rowNumber: number, map: ImportMapping, today: ISODate, dayFirst = true): DraftResult {
  const get = (f: ImportField) => (map[f] === undefined ? "" : (cells[map[f]!] ?? "").trim());
  const warnings: string[] = [];

  let firstName = get("firstName");
  let lastName = get("lastName");
  if (!firstName && get("fullName")) {
    const parts = get("fullName").split(/\s+/);
    firstName = parts.shift() ?? "";
    lastName = lastName || parts.join(" ");
  }
  if (!firstName) return { ok: false, row: rowNumber, error: "No name" };

  const date = (f: ImportField) => {
    const raw = get(f);
    if (!raw) return null;
    const d = parseLooseDate(raw, dayFirst);
    if (!d) warnings.push(`Couldn't read ${IMPORT_FIELDS[f].toLowerCase()} "${raw}"`);
    return d;
  };

  const expiresOn = date("expiresOn");
  const startsOnRaw = date("startsOn");
  const planRaw = get("planName");
  const plan = matchPlan(planRaw);
  let membership: ImportDraft["membership"] = null;

  if (expiresOn) {
    let startsOn = startsOnRaw;
    let startEstimated = false;
    if (!startsOn) {
      // Work the start back from the plan length; if the plan is unknown, the start is "now-ish".
      startsOn = plan ? planStartFor(plan, expiresOn) : expiresOn < today ? expiresOn : today;
      startEstimated = true;
    }
    if (startsOn > expiresOn) startsOn = expiresOn;
    const credits = Number(get("sessionsLeft"));
    const kind = plan?.kind ?? "membership";
    membership = {
      planId: plan?.id ?? "glofox",
      planName: plan?.name ?? (planRaw || "Glofox membership"),
      kind,
      startsOn,
      endsOn: expiresOn,
      sessionsTotal: kind === "pt" ? (Number.isFinite(credits) && credits > 0 ? credits : plan?.sessions ?? null) : null,
      startEstimated,
    };
    if (!plan && planRaw) warnings.push(`Plan "${planRaw}" kept as-is (no matching Superfit plan)`);
  } else if (planRaw) {
    warnings.push("Membership has no expiry date, so it wasn't imported");
  }

  const code = get("cardCode") ? normalizeCode(get("cardCode")) : null;
  return {
    ok: true,
    draft: {
      row: rowNumber,
      firstName,
      lastName,
      email: get("email") || null,
      phone: get("phone") || null,
      birthDate: date("birthDate"),
      gender: get("gender") || null,
      externalId: get("externalId") || null,
      cardCode: code && code.length >= 3 ? code : null,
      notes: get("notes") || null,
      membership,
      warnings,
    },
  };
}

/** Inverse of planEndDate: when a plan that ends on `end` must have started. */
function planStartFor(plan: Plan, end: ISODate): ISODate {
  const after = addDays(end, 1);
  return "days" in plan.duration ? addDays(after, -plan.duration.days) : addMonths(after, -plan.duration.months);
}
