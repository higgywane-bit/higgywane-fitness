# Superfit Admin: Blueprint & Handoff

The plan for the whole Superfit back office: what each part does, where every number comes from, how the pieces connect, and what to do when this moves to Lovable (or anything else) to connect the live APIs.

- **Membership system and desk workflows** (check-in, selling plans, moving off Glofox): `docs/MEMBERSHIP.md`
- **Public website and cafe:** `docs/PLAN.md`

---

## 1. The shape of it

```
                 ┌────────────── Superfit Admin (/admin) ──────────────┐
 Front desk ───▶ │ Check-in · Members · Plans · Passes                 │
 Owner      ───▶ │ Dashboard (modules) · Sales · Insights · Settings   │
                 └───────────────┬─────────────────────────────────────┘
                                 │  one set of rules (lib/membership, lib/dashboard, lib/reports)
                 ┌───────────────▼───────────────┐
                 │  Postgres  (Supabase later)   │  members, plans, check-ins, sales,
                 └──▲──────────▲──────────▲──────┘  reports, settings, reminders
                    │          │          │
           Qashier CSV / API   Glofox CSV reports   Website (cafe orders, member app: later)
```

Three ideas hold it together:

1. **One database.** Everything (members, visits, sales, uploaded reports, dashboard layout) lives in Postgres. Any frontend, ours or Lovable's, reads the same tables.
2. **Rules are written once.** Days left, active/expiring, revenue this month: each is one pure TypeScript function with tests. Screens only display them. That's why the dashboard, check-in screen and reminder emails can never disagree.
3. **Connect by contract.** Qashier, Glofox, email and payments plug in through small adapters with a defined input shape. Today they're CSV uploads or "log only"; switching to the live API changes the adapter, not the screens.

---

## 2. Modules

| Module | Status | What it does | Data |
|---|---|---|---|
| **Check-in** | Built | Scanner / camera / typed code / name search → allowed or turned away, days left, renew on the spot | Superfit |
| **Members** | Built | List with status filters, search; profile with plan, pause, add days, cancel, PT sessions, visits, history, activity | Superfit |
| **Member pass** | Built | Private QR page per member (`/pass/<secret>`), stand-in for the member app | Superfit |
| **Glofox import** | Built | One-off migration of the client list, memberships and card numbers | Glofox CSV |
| **Dashboard** | Built | Modules switched on/off, reordered, half/full width, presets; saved for every device | Superfit + Qashier |
| **Sales** | Built (CSV) | Till totals, by type, recent receipts; Qashier CSV import with receipt de-dupe | Qashier |
| **Insights** | Built | Upload any Glofox report; it's read automatically with adjustable charts. Kept out of the live dashboard | Glofox CSV |
| **Reminders** | Built (log only) | Renewal emails 7 days / last day / 3 days lapsed; sends once Resend is set | Superfit |
| **Cafe orders** | Built | Website orders on a live board for the bar (new → preparing → ready → collected) with a chime; customers see progress on their order page | Website |
| **Leads** | Built | Enquiry pipeline (new → contacted → trial → joined / lost), follow-up dates, notes, convert to member; website PT requests and coach messages arrive automatically | Superfit + Website |
| **Coaching** | Built | PT booking inbox from the website, sessions logged against a coach (or no-show), coach leaderboard with commission, active packs | Superfit + Website |
| **Messages** | Built (preview until email is connected) | Email a segment (active, expiring, at risk, lapsed, never bought, tag) with templates and {firstName}/{plan}/{daysLeft} | Superfit |
| **Performance** | Built | Period picker; targets; sales, costs, profit, margin; profit and loss by month; member flow (joined, came back, left); churn; renewal rate; cohort retention; visits; coaches; cafe | Superfit + Qashier |
| **Expenses** | Built | Costs ledger by month with monthly recurring costs (rent, wages, software) | Superfit |
| **Staff** | Built | Team list and profiles (role, PIN, hourly rate, PT commission), hours and pay estimate, what each person did | Superfit |
| **Rota & hours** | Built | Weekly rota by person and area, copy last week, planned vs clocked hours, wage estimate | Superfit |
| **Who's working** | Built | Each device picks the staff member on shift (PIN if set) and clocks them in and out; every action is logged under their name | Superfit |
| **Activity log** | Built | Everything that happened in the last 30 days, filter by type and by staff member | Superfit |
| **Exports** | Built | CSV of members, check-ins, sales, leads, expenses, timesheets, PT sessions | Superfit |
| **Settings** | Built | Connections status, reminders queue, desk rules, hardware tips, exports, team access, demo data | — |
| **PT app + coach portal** | Built | Selling a PT pack with a coach links the client and sends their app invite; coaches build workouts, nutrition and daily feedback in `/coach`, and clients train with them in `/app`. See `docs/PT-APP.md` | Superfit |
| Qashier live feed | Ready to connect | Webhook endpoint waiting for Qashier API access | Qashier API |
| Staff logins & roles | Next | Real sign-in replacing the "who's working" picker; role permissions (roles already stored on each staff member) | Supabase Auth |
| Member accounts | Next | Members sign in on the website and see their pass, history, PT balance | Supabase Auth |
| Online renewals | Later | Pay by PromptPay/card from the pass page | Opn / 2C2P |
| LINE notifications | Later | Reminders and PT confirmations by LINE | LINE OA |
| Wallet passes, door access | Later | Apple/Google Wallet pass; turnstile using the same check-in rule | — |

---

## 3. Dashboard modules

The dashboard is a list of module ids, saved in `app_settings` under `dashboard.layout`. Each module is defined once in `lib/dashboard/catalog.ts` (name, description, allowed widths), loads its own numbers in `lib/dashboard/data.ts`, and draws itself in `components/admin/dashboard/widgets.tsx`. Data is pulled fresh on every page load; shared data (the member list, last 70 days of visits and sales) is fetched once per page and shared by every module.

**Presets:** Owner · Front desk · Sales & cafe · Growth. Staff pick one, then add, hide and reorder modules in **Customise**.

| Module | Shows | Definition |
|---|---|---|
| `kpi-active` | Active members (+ new this month) | Members, not archived, whose status is *active* or *expiring* today |
| `kpi-in-today` | In today vs last week | Distinct members with an allowed check-in since 00:00 today; compared with the same weekday last week up to the same time |
| `kpi-expiring` | Expiring soon (+ paused) | Status *expiring*: cover ends in ≤ 7 days (`content/gym.ts`) |
| `kpi-new-members` | New members vs last month | Members created this month vs the same days last month |
| `kpi-memberships-sold` | Plans sold this month, count + ฿ | Memberships sold at the desk (not imported) created this month, not cancelled |
| `kpi-visits-per-member` | Average visits | Allowed check-ins in the last 30 days ÷ active members |
| `kpi-sales-today` | Till total today | Sum of sales today; vs the same weekday last week up to the same time |
| `kpi-sales-week` | Last 7 days | Today and the 6 days before; vs the 7 days before that |
| `kpi-sales-month` | Month to date | 1st → today; vs the same days last month |
| `kpi-avg-sale` | Average receipt | Month-to-date sales ÷ receipts |
| `visits-daily` | Bar chart, 30 days | Allowed check-ins per day |
| `busy-hours` | Heatmap weekday × hour | Allowed check-ins in the last 8 weeks, within opening hours |
| `active-trend` | Bar chart, 12 weeks | Distinct members with a live gym membership on each of the last 12 weekly dates |
| `sales-daily` | Bar chart, 30 days | Sales per day |
| `sales-monthly` | Bar chart, 12 months | Sales per calendar month (Bangkok time) |
| `sales-by-type` | Ranked bars | Month-to-date sales by category (cafe, memberships, PT, retail, other) |
| `top-sellers` | Ranked list | Month-to-date line items by revenue, with quantity |
| `members-by-plan` | Ranked bars | Active members grouped by their current plan |
| `expiring-list` | List | Expiring members, soonest first |
| `win-back` | List | Expired within the last 30 days, most recent first |
| `latest-checkins` | Feed | Last 8 scans, allowed and turned away |
| `top-visitors` | List | Most allowed check-ins in the last 30 days |
| `birthdays` | List | Birthdays in the next 7 days |
| `recent-sales` | List | Last 8 receipts |
| `kpi-profit-month` | Profit this month | Month-to-date sales − month-to-date costs (monthly costs counted on their day) |
| `kpi-costs-month` | Costs this month | Month-to-date expenses, vs the same days last month |
| `targets` | Progress bars | This month vs the owner's targets (sales, new members, active members, PT sessions) |
| `profit-monthly` | Bar chart, 12 months | Sales − costs per calendar month; losing months shown empty and counted |
| `kpi-renewal-rate` | % renewed | Plans (a week or longer) that ended 14–104 days ago and were followed by another plan within 14 days |
| `kpi-churn` | Members lost this month | Active on the 1st, not active today |
| `at-risk` | List | Active members with no visit in 14+ days (or never, if joined 14+ days ago) |
| `kpi-open-leads` | Open leads (+ follow-ups due) | Leads not joined or lost; follow-up date today or earlier |
| `follow-ups` | List | Open leads with a follow-up due |
| `kpi-cafe-orders` | Orders today (+ waiting) | Website cafe orders today, not cancelled; waiting = new or preparing |
| `kpi-pt-month` | PT sessions this month | Sessions marked done this month; plus booking requests waiting |
| `on-shift` | List | Staff on today's rota or clocked in today, with hours so far |

**Adding a module** (about 15 minutes): add an entry to `WIDGETS` in `catalog.ts` → a loader in `LOADERS` (`data.ts`) → a renderer in `RENDERERS` (`widgets.tsx`). TypeScript refuses to build until all three exist, and `tests/unit/dashboard.test.ts` runs every loader against demo data.

---

## 4. Metric definitions (the glossary)

These are the rules. If a number on any screen disagrees with this list, the screen is wrong.

| Term | Meaning |
|---|---|
| **Gym day** | Calendar date in Bangkok time (UTC+7, no daylight saving). All "today", "this month" and chart buckets use it |
| **Cover** | The dates a member can train: a membership from its start to its end date **inclusive**, extended through any renewal that starts on or before the day after |
| **Days left** | Last day of cover − today. 0 = last day today |
| **Active** | Has cover today and isn't paused |
| **Expiring** | Active with ≤ 7 days left |
| **Paused** | Today falls inside a pause; the end date was pushed back by the pause length |
| **Upcoming** | Next plan starts in the future, nothing covers today |
| **Expired / lapsed** | Had a gym plan; the latest one ended before today |
| **No plan** | Never had a gym plan (may have PT only) |
| **Visit** | An allowed check-in. A second scan within 2 minutes isn't a new visit. Turned-away scans are logged but never counted as visits |
| **Sale** | A till receipt (Qashier), stored in satang, de-duplicated by receipt number. Voids/refunds are skipped on import |
| **Sales category** | From item names: PT, membership, cafe, retail, other |
| **Membership revenue** | Shown from Qashier (the till is the source of truth for money). Prices typed at the desk are a record, never added on top |
| **PT balance** | Sessions in the pack − sessions logged; the pack expires on its end date |
| **PT session** | One logged session against a pack, credited to a coach. A no-show still uses the session |
| **Coach pay (est.)** | For each session: pack price ÷ sessions in the pack × the coach's commission % |
| **At risk** | Active, but no visit in 14+ days (`AT_RISK_DAYS`) |
| **Joined / came back / left** | Over a period: joined = first-ever gym plan started; came back = had a plan before, inactive at the start, active at the end; left (churned) = active the day before the period, not active on its last day |
| **Churn rate** | Left ÷ active at the start. Retention = 1 − churn |
| **Renewal rate** | Of plans a week or longer that ended in the period (and whose 14-day grace has passed), the share followed by another plan starting within 14 days of the end, or earlier |
| **Cohort retention** | Members grouped by the month of their first plan; share with an active plan at the end of month 1, 2, 3… |
| **Costs** | Expenses; a monthly expense repeats on the same day each month until its end date |
| **Profit** | Sales (Qashier) − costs, per calendar month or period. Margin = profit ÷ sales |
| **Revenue per member** | Sales in the period ÷ average active members (sampled weekly) |
| **Hours worked** | Clock-in to clock-out; an open entry counts up to now. Wages (est.) = hours × hourly rate |
| **Lead conversion** | Leads created in the last 30 days that reached "joined" |

The code for these: `lib/membership/access.ts` (member states), `lib/admin/analytics.ts` (time buckets, comparisons), `lib/dashboard/data.ts` (each figure).

---

## 5. Insights (uploaded reports)

For reading Glofox history, and any other CSV, without building an importer per report.

1. Upload one or more CSVs on **Insights**. Rows are stored exactly as uploaded (`report_uploads`), so nothing is lost and any report can be re-read later.
2. The analyser (`lib/reports/analyze.ts`) reads every column and decides what it is: date, time, money, number, ID, category or text. It then picks the report type:
   - **Sales / transactions:** there's a money column and words like transaction / payment / amount
   - **Attendance / bookings:** booking / class / check-in / attended
   - **Members / clients:** email / phone / name, no money
   - **Memberships:** membership or plan with start / expiry
   - **Other:** anything else still gets row counts, totals and breakdowns
3. Figures: headline numbers (revenue, transactions, average; or visits, unique members, visits per member), by month (up to 36 months), by weekday, by hour, top items, and breakdowns by every short-list column.
4. **Everything is adjustable** on the report page: report type, which date column, what to measure (row count or the sum of any number column), and what to group by. Choices are kept in the link, so a view can be bookmarked.
5. Uploading the same report again (e.g. a new quarter) **adds to it**. The Insights home reads all uploads with the same columns together, and rows repeated across files count once.

Insights is deliberately separate from the live dashboard: it's history and one-off analysis, not today's numbers.

---

## 6. Data model

Postgres, defined in `lib/db/schema.ts`, SQL migrations in `drizzle/` (plain SQL that runs on Supabase unchanged).

| Table | Purpose | Key fields |
|---|---|---|
| `members` | People | `member_no` (#1001…), names, contact, `birth_date`, `pass_token` (secret), `source` (admin / glofox / app / demo), `external_id` (Glofox id), `archived_at` |
| `credentials` | What opens the door | `kind` (qr / card), `code` (unique, normalised), `revoked_at` |
| `memberships` | Each plan sold | `plan_id`, `kind` (membership / pt), `starts_on`, `ends_on` (inclusive), `sessions_total/used`, `price` (whole ฿), `payment_method`, `payment_ref`, `frozen_from/until`, `cancelled_at` |
| `check_ins` | Every scan | `member_id` (null for unknown codes), `code`, `method` (scan / camera / typed / search), `allowed`, `reason`, `at` |
| `sales` | Till receipts | `source` + `external_id` (unique), `occurred_at`, `amount_satang`, `category`, `items` (jsonb: name, qty, amountSatang), `member_id` |
| `report_uploads` | Insights files | `kind`, `name`, `headers`, `rows` (jsonb, as uploaded), `row_count`, `date_from/to` |
| `app_settings` | Shared preferences | `key` → `value` jsonb (e.g. `dashboard.layout`) |
| `activity` | Timeline + audit log | `member_id`, `lead_id`, `staff_id`, `type`, `message`, `at` |
| `reminders` | Emails sent | unique (`member_id`, `ends_on`, `kind`) so each sends once |
| `staff` | Team | `name`, `role` (owner / manager / desk / coach / cafe), `pin_hash`, `coach_slug` (links to the website profile), `hourly_rate`, `pt_commission_pct`, `active` |
| `shifts` | Rota | `staff_id`, `date`, `start`, `end` (HH:MM), `area` (desk / cafe / floor / pt / cleaning) |
| `time_entries` | Clock in / out | `staff_id`, `clock_in`, `clock_out` (null while clocked in) |
| `leads` | Enquiries | name, contact, `source`, `interest`, `stage`, `owner_id`, `next_follow_up`, `lost_reason`, `member_id` once joined |
| `pt_sessions` | PT delivered | `member_id`, `membership_id` (the pack), `coach_id`, `at`, `status` (done / no-show) |
| `pt_bookings` | Website PT requests | coach, package, date, time, contact, `status` (requested / confirmed / declined / done), `lead_id` |
| `cafe_orders` | Website cafe orders | `number`, `status`, customer, service, `lines` (jsonb), `subtotal` (฿), macros, payment method/status |
| `expenses` | Costs | `date`, `category`, `description`, `amount_satang`, `recurring` (none / monthly), `ends_on` |
| `messages` | Sent emails | audience segment, subject, body, recipients, sent, status (sent / preview), `staff_id` |

`activity` also records `staff_id` (who did it) and `lead_id`. Members carry `tags` (text array). Rows created as demo data carry `demo = true` (or belong to demo staff/members) and are removed by Settings → Remove demo data.

Plans and prices are not in the database: they come from `content/pricing.json` (the owner's list) plus durations in `content/plans.ts`. Each sale records the plan name and price paid, so changing prices never rewrites history.

---

## 7. Connections (contracts)

| Connection | Today | When live | Contract |
|---|---|---|---|
| **Qashier sales** | CSV export → Admin → Sales | Qashier webhook → `POST /api/qashier/webhook` | Header `x-superfit-secret`. Body `{ sales: [{ receiptNo, occurredAt (ISO), total (฿), paymentMethod?, status?, items?: [{ name, qty, amount }] }] }`. Fit `toSale()` in the route to Qashier's real payload |
| **Glofox members** | Client CSV → Members → Import | none needed (one-off) | Column matching in `lib/membership/glofox.ts` |
| **Glofox reports** | Any CSV → Insights | none needed | Free-form; analyser adapts |
| **Reminder emails** | Worked out and logged | Resend (`RESEND_API_KEY`, `EMAIL_FROM`) | Daily `GET /api/cron/reminders` with `Authorization: Bearer $CRON_SECRET` |
| **Database** | PGlite (local) | Supabase Postgres (`DATABASE_URL`) | `npm run db:migrate` |
| **Admin access** | Open, or `ADMIN_PASSCODE` | Supabase Auth with roles | — |
| **Payments** | Mock (cafe checkout) | Opn / 2C2P / Qashier | `lib/payments/types.ts` `PaymentProvider` |

### Everything the admin can do (the API surface)

All writes go through these server actions in `app/admin/actions.ts`. Each is a thin wrapper over a plain function in `lib/`, so any backend (Supabase Edge Functions, RPC, another framework) can call the same functions.

| Action | Function |
|---|---|
| Check in by code or member | `checkIn()` · `lib/membership/service.ts` |
| Create / update / archive member | `createMember()` `updateMember()` `setArchived()` |
| New QR, link card, remove card | `regenerateQr()` `addCard()` `revokeCredential()` |
| Sell plan, pause, resume, add days, cancel, log PT | `sellPlan()` `freezeMembership()` `unfreezeMembership()` `extendMembership()` `cancelMembership()` `useSession()` |
| Glofox preview / import | `planImport()` `runImport()` · `lib/membership/import.ts` |
| Qashier CSV import | `importSales()` · `lib/sales/service.ts` |
| Upload / retype / delete report | `saveReport()` `updateReport()` `deleteReport()` · `lib/reports/service.ts` |
| Save dashboard layout | `saveLayout()` · `lib/dashboard/layout.ts` |
| Send reminders | `sendReminders()` · `lib/membership/reminder-service.ts` |
| Tags, notes, message a segment | `setMemberTags()` `addMemberNote()` `sendMessage()` · `lib/messages/service.ts` |
| Leads | `createLead()` `updateLead()` `setLeadStage()` `addLeadNote()` `convertLead()` · `lib/leads/service.ts` |
| PT requests, log session | `saveBookingRequest()` `setBookingStatus()` · `lib/coaching/service.ts`; `useSession(…, { coachId, status })` |
| Cafe orders | `saveWebOrder()` `setOrderStatus()` `markOrderPaid()` · `lib/cafe/orders.ts` |
| Staff, rota, time clock | `createStaff()` `updateStaff()` `verifyPin()` `addShift()` `copyWeek()` `clockIn()` `clockOut()` · `lib/staff/service.ts` |
| Expenses, targets | `addExpense()` `endRecurring()` · `lib/expenses/service.ts`; `saveTargets()` · `lib/performance/targets.ts` |
| CSV exports | `GET /admin/export/{members,check-ins,sales,leads,expenses,timesheets,pt-sessions}` |

Who did it: every action runs inside `withActor(staffId)` (`lib/staff/context.ts`), and `logActivity()` stamps that staff id. With real logins, pass the signed-in staff id instead of the device cookie.

---

## 8. Handing over to Lovable

Lovable builds React (Vite) + Supabase apps. It won't run this Next.js app's server code as-is, so plan the move as **keep the data and rules, rebuild the screens where it helps.**

**Keep exactly as-is**
1. **The database.** Create a Supabase project (Singapore region), run the SQL files in `drizzle/` in order, then set `DATABASE_URL` here. This app and Lovable then share live data from day one, so you can switch screen by screen instead of all at once.
2. **The rules** (pure TypeScript, no Next.js inside): `lib/membership/access.ts`, `dates.ts`, `codes.ts`, `reminders.ts`, `glofox.ts`; `lib/performance/metrics.ts`; `lib/expenses/rules.ts`; `lib/staff/rules.ts`; `lib/messages/segments.ts`; `lib/leads/constants.ts`; `lib/reports/analyze.ts`; `lib/dashboard/catalog.ts`; `lib/admin/analytics.ts`; `lib/csv.ts`; `lib/sales/qashier.ts`; `content/*`. Copy them into the Lovable project unchanged, together with `tests/unit/` so they stay correct.
3. **This document's definitions** (sections 3–4). Paste them into Lovable's knowledge/instructions so generated code uses the same meanings.

**Rebuild in Lovable**
- Screens: use this app as the visual reference (screenshots or the live URL). Brand tokens are in `app/globals.css`.
- Server actions → Supabase Edge Functions that call the same rule functions (section 7 table), or direct table writes for simple edits.
- Cron and webhook routes → Supabase Edge Functions + `pg_cron` (or keep them on Vercel).
- Auth → Supabase Auth with a `staff` table (role: owner / manager / desk) and row-level security: staff read/write everything; members read only their own row, pass and history.

**Rules that must survive any rewrite**
- End dates are inclusive; days left counts through paid renewals; renewals start the day after cover ends.
- Pausing moves the end date; ending a pause early gives the unused days back.
- PT packs never open the door.
- A revoked code never works again; codes are normalised (O→0, I/L→1) before lookup.
- Qashier is the source of truth for money; desk prices are a record, never added on top.
- Sales de-dupe on (source, receipt number); reminders on (member, end date, kind).
- All dates are Bangkok calendar days.
- Every staff action is logged with who did it.
- A lead with the same phone or email as an open lead is the same person (no duplicates).
- Monthly costs repeat until their end date; profit uses Qashier sales minus costs.

**Prompt starter for Lovable**
> Build the Superfit admin on the existing Supabase schema (tables: members, credentials, memberships, check_ins, sales, report_uploads, app_settings, activity, reminders, staff, shifts, time_entries, leads, pt_sessions, pt_bookings, cafe_orders, expenses, messages). Import the TypeScript modules in /core unchanged and use them for every membership status, days-left and dashboard figure: never recompute these in components. Follow docs/ADMIN-PLAN.md sections 3–4 for definitions and docs/MEMBERSHIP.md for desk workflows. Dark, black and white with one red accent (#E11D48), condensed heavy display type, mobile first.

---

## 9. Roadmap

**Phase 1: go live at the desk (now)**
- [ ] Owner answers the open questions below
- [ ] Supabase project + `DATABASE_URL`, `ADMIN_PASSCODE` set, deploy
- [ ] Test-import the Glofox client list, spot-check 10 members, remove demo data
- [ ] Confirm the scanner reads phone QR codes (or buy a 2D imager)
- [ ] Switch-over day: re-import, start checking in on Superfit, send passes
- [ ] Upload Glofox transaction and attendance history into Insights
- [ ] Enter fixed monthly costs (rent, wages, software) in Expenses and set targets on Performance

**Phase 2: connect**
- [ ] Qashier API access → webhook live, CSV imports stop
- [ ] Resend + sending domain → reminder emails on
- [ ] Add the real team in Staff (PINs, hourly rates, coach commission), build the first rota
- [ ] Staff logins (Supabase Auth) replacing the device picker; enforce role permissions
- [ ] Cancel Glofox

**Phase 3: members**
- [ ] Member sign-in (phone OTP or LINE Login) showing pass, plan, visits, PT
- [ ] Renew online (PromptPay / card)
- [ ] Apple / Google Wallet passes
- [ ] LINE reminders

**Phase 4: grow**
- [ ] PT calendar (coach availability, sessions booked into slots, reminders to clients)
- [ ] Cafe stock and recipe costs (margin per drink), linked to Expenses
- [ ] Churn by plan and first-90-days drop-off modules
- [ ] Payroll export in the accountant's format
- [ ] Thai language

---

## 10. Open questions

1. A few rows from each Glofox report you want in Insights (transactions, attendance, client list) to check the columns are read as expected.
2. Does the existing scanner read QR codes on phone screens?
3. PT pack expiry (placeholder 1 / 2 / 4 / 6 months for 1 / 3 / 10 / 20 sessions) and whether "1 Month" means a calendar month (as built) or 30 days.
4. Qashier: API access status and a sample sales export (with item names, for top sellers).
5. Which staff need logins, and what each role may do (e.g. may the front desk cancel plans or give free days?).
6. Which dashboard preset should be the default for the owner, and which for the desk iPad?
