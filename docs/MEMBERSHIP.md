# Superfit Membership System (replacing Glofox)

Our own members database, front-desk check-in and admin, built into this app at `/admin`.
It does what Superfit actually used Glofox for, and nothing it didn't:

| Glofox today | Superfit admin |
|---|---|
| Member account in Glofox | Member record in our own Postgres database |
| Plastic card with a barcode | **QR code on the member's phone** (`/pass/<secret>` link). Old Glofox cards keep working |
| Scan the card at reception | Scan the phone with the existing USB scanner, the iPad camera, or type the 8-character code |
| Membership end dates | Plans sold at the desk, with days left worked out automatically, including paid-ahead renewals and pauses |
| Member list and reports | Dashboard: active, expiring, lapsed, visits, busy hours, Qashier sales |
| Monthly fee | Hosting costs only (Vercel + Supabase, free/low tier at this size) |

The rest of the back office (modular dashboard, Insights for Glofox reports, metric definitions, Lovable handoff, roadmap) is in `docs/ADMIN-PLAN.md`.

Left out on purpose: class timetables, online booking, automated billing, marketing suites. Add later only if needed.

---

## 1. A day at the front desk

**New member**
1. Admin → Members → **New member**. Name, phone, email (for reminders). Optionally pick a plan and how they paid.
2. They get a QR code straight away. Tap **Send pass** and share the link by LINE/WhatsApp/AirDrop. They save it to their home screen.
3. Take payment on the Qashier terminal as now. Put the Qashier receipt number in the reference field if you want to match it later.

**Check-in** (Admin → Check-in, left open on the reception laptop or iPad)
- Member shows their phone → scan. Green screen: *Welcome back, Nicha · 23 days left · 4 visits this month*.
- **3 days or fewer left:** amber screen with *Renew now*. On the last day: *Last day today*.
- **Expired / no plan / paused / unknown code:** red screen saying why, with *Renew* or *Sell a plan* right there. After selling, they're checked in automatically.
- A second scan within 2 minutes isn't counted twice.
- Old Glofox card? Scan it the same way.
- Forgot their phone? Search their name or phone number and tap them.

**Day passes and walk-ins.** A walk-in who won't make an account pays cash/Qashier as today; nothing to enter. If they're happy to give a name, create them and sell a Day Pass: then they're in the system and come back as a lead. A Day Pass covers the whole day, so they can come and go.

**Renewals** start the day after the current plan ends, so nobody loses days by renewing early. *Days left* counts through the renewal.

**Pause** (injury, travel): pick dates and the end date moves back by the same number of days. *Resume now* gives back the unused days.

**Add days** for comps or make-goods. **Cancel plan** for refunds or mistakes; it stays in their history.

**PT packs** are sold the same way. Tap *Log a session* after each one; check-in shows how many are left.

**Lost phone or a shared screenshot:** *New code* on their profile. The old code stops working straight away; their pass link shows the new one.

---

## 2. Member identity

- **Access code:** 8 characters, no look-alike letters (no I, L, O, U), e.g. `K7M2 Q9PX`. It's what the QR holds and what staff type when there's no scanner.
- **Pass link:** `/pass/<random>`, unguessable and separate from the code. Shows the QR, the plan, days left and PT sessions. This is the stand-in for the member app until logins exist.
- **Cards:** existing Glofox card numbers are imported and linked, so the switch doesn't need new cards on day one.
- **Scanner:** any USB/Bluetooth scanner acts like a keyboard: it types the code and presses Enter, and the check-in page listens for that. **Check the current scanner reads QR codes from a phone screen.** That needs a 2D imager. If it's a 1D laser model it will only read the old card barcodes; a 2D one (Zebra DS2208, Honeywell Voyager 1470g, or a budget equivalent) costs roughly ฿1,500–4,000. The iPad camera mode works in the meantime.

---

## 3. How it's built

- **App:** Next.js (same codebase as the website), `/admin` routes, server actions for every change. Works on the reception laptop, an iPad, or a phone.
- **Database:** Postgres through Drizzle ORM (`lib/db/schema.ts`, migrations in `drizzle/`).
  - Local and tests: **PGlite**, a real Postgres running inside Node, stored in `.data/`. No setup.
  - Live: set `DATABASE_URL` to a hosted Postgres (**Supabase**, Singapore region; it also gives us member logins later). Run `npm run db:migrate` on deploy.
- **Rules live in pure functions** (`lib/membership/access.ts`): days left, stacked renewals, pauses, PT sessions, expiring/expired status. The check-in screen, member list, dashboard and reminder emails all call the same functions, so they always agree. Unit-tested, plus tests that run the real database.

### Data

| Table | What it holds |
|---|---|
| `members` | Name, nickname, contact, birthday, notes, member number (#1001…), pass secret, source (admin / glofox / demo), archived |
| `credentials` | Access codes: the phone QR and any linked cards. Revoked codes are kept, not deleted |
| `memberships` | Each plan sold: plan, start, end (inclusive), price paid, payment method + receipt ref, pause dates, PT sessions used, cancelled |
| `check_ins` | Every scan, allowed or turned away, with the reason and method (scan / camera / typed / search) |
| `sales` | Till sales from Qashier, keyed by receipt number so re-imports never double count |
| `activity` | Member timeline: created, sold, paused, extended, new code, reminder sent |
| `reminders` | One row per reminder email sent, so nobody gets the same email twice |

Plans and prices come from `content/pricing.json` (the owner's price list); `content/plans.ts` adds how long each lasts. Desk rules (expiring threshold, renewal nudge, reminder days, opening hours) are in `content/gym.ts`.

---

## 4. Moving off Glofox

1. **Export:** Glofox → Manage → Clients → Actions → Download (CSV). Make sure the membership name, membership expiry and barcode columns are in it.
2. **Test import:** Admin → Members → *Import from Glofox*. Columns are matched automatically (change any that are wrong); dates are read day-first (`03/10/2026` = 3 Oct) with a switch if Glofox exported month-first. The preview shows who's new, who's a duplicate, active memberships carried over and cards linked. **Nothing is saved until you press Import.**
3. Check a handful of members against Glofox: name, end date, card scans.
4. **Remove demo data** (Settings) once happy.
5. **Switch-over day:** export again and import again. Existing people aren't duplicated (matched on Glofox ID, email, phone or card); only later expiry dates and new cards are added.
6. Start checking in on Superfit admin. Send each member their pass link as they come in (or in bulk by LINE broadcast), and old cards keep working meanwhile.
7. Run both side by side for 1–2 weeks if you want a safety net, then cancel Glofox.

Glofox has no open API for this (and charges for integrations), so the CSV export is the route. It only needs to happen once or twice.

---

## 5. Qashier (sales)

- **Now:** export transactions from the Qashier back office as CSV and drop the file on Admin → Sales. Line-item exports are summed per receipt; voids/refunds are skipped; anything already imported is ignored. Sales are bucketed into memberships / PT / cafe / retail from the item names.
- **Later:** Qashier offers API access on request. When enabled, point its transaction webhook at `/api/qashier/webhook` (secret header `x-superfit-secret` = `QASHIER_WEBHOOK_SECRET`) and the dashboard fills itself. The adapter in that route needs fitting to Qashier's real payload once we have a sample.
- Membership sales are recorded in the admin when sold (plan, price, Qashier receipt ref), and the Qashier figures stay the source of truth for revenue. They're shown side by side, never added together.

---

## 6. Renewal reminders

A daily job (`/api/cron/reminders`, 09:00 Thailand time via `vercel.json`) emails members:
- **7 days** before cover runs out and **on the last day / day before**,
- **3 days after** it lapses (“we miss you”), only within a week of expiry.

Members who already renewed, opted out, have no email or are archived are skipped. Day passes and short plans don't get a "week left" email. Each email sends once per plan. Until `RESEND_API_KEY` + `EMAIL_FROM` are set, it works everything out and logs it but sends nothing; Settings shows who's due. LINE messages can use the same list later.

---

## 7. Security and privacy

- `/admin` is open by default for easy setup. **Before real member data goes online, set `ADMIN_EMAIL` and `ADMIN_PASSWORD`**: the Superfit email signs in once per device (30-day session), then staff pick who's working with their PIN. Every admin server action re-checks the session, not just the middleware.
- Pass links are secret 144-bit tokens, `noindex`, and show only name, member number, plan status and the QR.
- Webhook and cron routes need their own secrets.
- Member data is personal data under Thailand's PDPA: keep the database in the Singapore region, collect only what's on the form, and archive (or delete on request) members who leave.

---

## 8. What comes next

1. **Member accounts:** sign-in on the website (Supabase Auth: phone OTP or LINE Login) shows the same pass, history and PT balance. The pass link becomes the logged-in pass.
2. **Online renewals:** PromptPay / card via the payment layer already in `lib/payments/` (Opn or 2C2P).
3. **Apple Wallet / Google Wallet passes** carrying the same code.
4. **LINE notifications** for reminders and PT session confirmations.
5. **Staff accounts and roles**, with who-did-what in the activity log.
6. **Door / turnstile access** using the same `checkIn()` decision.
7. **Thai language** across admin and pass.

---

## 9. Questions for the owner

1. Does the current Glofox scanner read QR codes on phone screens (2D imager), or only card barcodes?
2. A sample Glofox client export (a few rows is enough) to confirm the columns.
3. PT pack expiry: how long are 1 / 3 / 10 / 20 session packs valid? (Placeholder: 1 / 2 / 4 / 6 months.)
4. Is 1 Month a calendar month (3 Oct → 2 Nov, as built) or exactly 30 days?
5. Opening hours, and whether pauses have a minimum/maximum or a fee.
6. Qashier: request API access, and send a sample transaction export.
7. Email sending address (e.g. `hello@superfit.co.th`) and reminder wording, English and Thai.
