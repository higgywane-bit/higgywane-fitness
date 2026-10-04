# Superfit customer app

The members' side of Superfit: sign in, a digital check-in pass, "my membership", personal training and the cafe menu. It runs in the **same Lovable project and Supabase** as the admin, and looks like the admin: same header, cards, pills and fonts.

Preview of every screen, with build notes: `docs/customer-app-preview.html` (open it in a browser).

## What's in this repo for it

| File | What it does |
|---|---|
| `lib/customer/pass.ts` | Which code the pass shows (`pickPassCode`) and the member's status, days left and progress ring (`customerMembershipView`). Same rules as the desk. |
| `lib/customer/link.ts` | Who an app account belongs to (`decideLink`), suggestions for the admin queue, and the desk link QR (`SF-LINK-…`, `parseDeskScan`). |
| `supabase/customer-app.sql` | Tables and functions: `members.user_id`, invites, the App requests queue, `my_account()`, `set_my_photo()`, `request_pt_session()`, `public_catalog()`. |
| `supabase/functions/link-account` | Customer: called after every sign-in. Links them, or puts them in the queue with a desk QR. |
| `supabase/functions/member-invite` | Staff: "Invite to the app". Saves the email and sends a sign-in link. |
| `supabase/functions/desk-link` | Staff: link by scanning the app's QR, link or create from the queue, dismiss, unlink. |
| `tests/unit/customer.test.ts` | 16 tests for all of the above. |
| `lib/payments/promptpay.ts` | Thai QR: PromptPay QR for phone / tax ID / e-wallet, bill-payment QR with the order number as reference, reading any Thai QR back (checksum checked), reading bank-slip QRs, and slip checks (`checkSlip`). |
| `supabase/payments.sql` | `payment_intents` (one row per "please pay ฿X"), auto-marks the cafe order paid, Realtime, private `payment-slips` bucket, `open_payments` view for the desk. |
| `supabase/functions/promptpay` | Create a QR for an order or a desk charge, status, attach a slip, staff confirm, cancel. |
| `tests/unit/promptpay.test.ts` | 14 tests, including a reference payload from the widely used `promptpay-qr` library. |

`supabase/functions/_shared/link.ts` and `_shared/promptpay.ts` are copies of `lib/customer/link.ts` and `lib/payments/promptpay.ts` for Deno. A test fails if they drift. After changing either, copy it over again (`cp lib/payments/promptpay.ts supabase/functions/_shared/promptpay.ts`).

## How members get connected

Every path ends in the same place: `members.user_id` = their login. One login per member, one member per login.

1. **Invite at check-in (existing members).** Staff scan the tag. The result shows *No app yet*, so staff tap **Invite to app** and type the email. The member gets an email, taps the link, and they're in and linked. No codes, no forms.
2. **They sign up first.** There's a poster QR at the desk that opens the app, and they tap *Continue with Google* (or Apple, or email).
   - If their email is already on their member record (Glofox import, or staff typed it), they're **linked instantly**.
   - Otherwise the app shows **Show this at the desk** with a QR. Staff scan it into the normal check-in box, pick the member, and they're linked. A brand-new person gets **Create new member** instead.
3. **They never come to the desk.** Anyone who signs up and isn't linked appears in **Members → App requests** with best-guess matches (email, phone, name). Staff tap **Link** or **Create member**.
4. **New members from now on.** The New member form gets a **Send app invite** switch (on by default when there's an email), which runs path 1 automatically.

Safety rules, enforced on the server:
- Only **verified** emails link automatically. Google, Apple and email-link sign-in all verify, so offer no passwords, and keep *Confirm email* ON in Supabase.
- A family sharing one email always goes to the desk to pick who's who.
- Desk QR codes expire after 15 minutes. Archived members are never linked.

## The digital pass

- The pass QR and barcode hold **exactly the member's tag code** (the 6 digits). The phone and the keyring are interchangeable, and the check-in screen doesn't change.
- Members without a tag show their admin QR code. Link a tag at the desk any time (the existing *Link card* flow) and the app switches to it.
- Anti-screenshot: a live ticking clock, a pulsing dot and a moving border. Their photo also shows on the desk's check-in result, so staff see the face.
- **Hardware:** the RFID tag reader can't read phones. Add a **2D barcode scanner that reads screens** (USB, keyboard mode, Enter after each scan; about ฿1,000–2,500), plugged in next to the tag reader. Both type into the same SCAN box. An iPad can also scan with its camera (see admin prompt below).

## Before the prompts: set up Supabase (once)

1. SQL editor → paste `supabase/customer-app.sql` → Run. Then edit and run the commented `insert into public.staff_accounts …` line with the admin login's email.
   If your Lovable project already has its own roles table, point `is_staff()` at it instead.
2. Run the table check at the bottom of that file. Any table with RLS off is readable by every signed-in customer, so lock it down before launch.
3. Authentication → Providers: turn on **Google** and **Apple**. Email stays on, with *Confirm email* ON.
   Authentication → URL configuration: add your app URL and `<app>/welcome` to the redirect URLs.
4. Edge functions: add `link-account`, `member-invite`, `desk-link` and the `_shared` folder (paste the files, or ask Lovable to create them with this exact code). Set the secret `APP_URL` to the app's address.
5. Authentication → Email templates: brand the *Invite* and *Magic link* emails, e.g. "Your Superfit pass is ready. Tap to open it."

## Lovable prompts

Paste one at a time. Each assumes the previous one is done. Upload `lib/customer/*.ts` and `lib/membership/{access,dates}.ts` into `src/lib/` first, keeping the folders.

### 1. Design system and shell

> Build the members' app at `/app/*` in this project, using the **exact same design as the admin**: black background, cards `#0e0e10` with 1px `#27272b` borders and 24px corners, red `#e5194d` pill buttons, heavy condensed uppercase headings (same display font as admin), small red letter-spaced eyebrows, green/amber/red status pills, the same header (logo left, EN/ไทย toggle, round avatar right). Bottom tab bar with 5 tabs: Home, Menu, **Check-in** (raised red round button in the middle), PT, Membership; active tab red. Mobile first at 375px; 44px touch targets; respect reduced motion. Every screen has an English and Thai version. Copy the look from `docs/customer-app-preview.html`.

### 2. Sign in and linking

> `/app/login`: headline "YOUR GYM IN YOUR POCKET", buttons **Continue with Google** (white), **Continue with Apple** (black), and an email field with **Email me a sign-in link** (`supabase.auth.signInWithOtp`, `emailRedirectTo: <origin>/app/welcome`). No passwords. Below: "Got an email from Superfit? Tap the link in it."
> `/app/welcome`: after any sign-in, call the edge function `link-account` (send `{ name, phone }` if known). If it returns `status: 'linked'`, go to `/app`. If `pending`, go to `/app/link`.
> `/app/link`: eyebrow "ALMOST THERE", title "SHOW THIS AT THE DESK", a big white card with a QR of `SF-LINK-<deskToken>` and the token as "K7M2 Q9PX", plus a 15-minute countdown. When it runs out, call `link-account` again for a fresh one. Poll `rpc('my_account')` every 5 seconds; as soon as `linked` is true, show "You're linked. Welcome, <first name>." and go to `/app`.
> Every `/app/*` page except login and link requires a session and a linked account (otherwise redirect).

### 3. Home, check-in pass, membership

> Data for all three: `supabase.rpc('my_account')`. Work out status with `customerMembershipView(memberships, localDate())` from `src/lib/customer/pass.ts`. Never calculate days left or status in a component.
> **Home** `/app`: eyebrow greeting, first name as the title, a membership card (plan name, status pill, progress ring with days left, `view.message`) that opens Membership; a full-width red **Show my pass** button; three stat tiles (visits this month from `checkIns`, last check-in time, PT sessions left); a horizontal row of cafe product cards linking to Menu.
> **Check-in** `/app/pass`: a card with their photo (initials if none; green ring if `view.canTrain`, red if not), `#memberNo`, full name, status pill and plan; a white panel with a QR code and a CODE128 barcode both encoding `pickPassCode(credentials).code` exactly, and the code in large digits (`display`); under it a live clock "LIVE · 09:41:27" with a pulsing green dot; the card border has a slow moving red sheen. Request a screen wake lock while open. Hint: "Turn your brightness up and hold it under the scanner." Button **Change my photo**: upload to storage bucket `member-photos` at `<user id>/photo-<timestamp>.webp` (resize to 800px first), then `rpc('set_my_photo', { photo_url: <public url> })`.
> **Membership** `/app/membership`: mirror the admin member page. Eyebrow `#memberNo`, name, status pill; card "MEMBERSHIP / <PLAN>" with an inset showing days left and "covered until <long date>", the line "You're covered until midnight on this day.", a progress bar, Started/Ends; a PT card with sessions left as dots and **Book a session**; a Visits list from `checkIns` (date, time, tick).

### 4. Personal training

> `/app/pt`: coaches from `rpc('public_catalog').coaches` (only visible ones; fall back to the bundled coaches if null). Each coach is a card with portrait, name in the display font, tagline, specialty chips and **Request a session**. That opens a bottom sheet with day chips (next 7 days), time chips from the coach's session times, and goal chips; **Send request** calls `rpc('request_pt_session', { coach: slug, on_date, at_time, goal_text })` and shows "Request sent · <reference>". Show their PT sessions left at the top and their requests (`ptRequests`) with status.

### 5. Cafe menu

> `/app/menu`: reuse the Till's category tiles and product cards exactly (same components and data), without till actions. The + opens the product sheet with add-ons and live price and macros. **Order for pickup** writes a `cafe_orders` row with `channel: 'app'`, `member_id`, `payment_status: 'unpaid'` so it shows on the bar board; they pay at the counter.

### 6. Admin changes (desk side)

> 1. **Check-in box:** before checking in, run `parseDeskScan(input)` from `src/lib/customer/link.ts`. If it's a `link` scan, call `desk-link` `{ action: 'peek', token }` and open a **Link app account** sheet: their name/email/photo, the suggested members (one tap), a member search, and **Create new member**. Confirm calls `desk-link` `{ action: 'link', token, memberId }` (or `create`), then shows a green "Linked" result.
> 2. **Check-in result:** if the member has no `user_id`, show a small "No app yet" chip and an **Invite to app** button (email field prefilled from the member). It calls the `member-invite` function with `{ memberId, email }` and shows "Invite sent". Show the member's photo large on the result.
> 3. **Members → App requests** tab with a count badge: pending rows from `account_link_requests` (name, email, verified tick, phone, when), each suggestion as a member chip with its reasons (email/phone/name). Buttons: **Link**, **Create member**, **Dismiss** (all via `desk-link`).
> 4. **Member page:** an "App" card showing Linked (since date) / Invited (date) / Not set up, with **Invite**, **Resend** and **Unlink**.
> 5. **New member form:** a **Send app invite** switch, on when an email is filled in.
> 6. **Optional camera scan:** a camera button on check-in that reads QR/barcodes with the browser's BarcodeDetector (fallback: html5-qrcode) and feeds the result into the same box.

## Thai QR payments (PromptPay)

The customer scans a QR in any Thai bank app and the money goes **straight into the gym's account**: no provider, no fees, no contract. The QR is built in our own code (`lib/payments/promptpay.ts`), checked against the Bank of Thailand Thai QR standard.

**The one catch:** a plain PromptPay transfer doesn't tell anyone it happened. The bank notifies the gym's phone, not our app. So every payment has a confirm step:

| How it's confirmed | What it needs | When |
|---|---|---|
| **Staff tap Confirm** when it lands in the bank app | nothing | Now |
| **Customer scans their slip** in the app. We read the slip's QR (bank + transaction ref), staff see "Slip sent" and confirm in one tap. One slip can never pay twice. | nothing | Now |
| **Automatic, from the slip**: the slip's transaction ref is checked with a slip-verification API, then `checkSlip()` checks amount, receiver, time and re-use | an account with a slip-verification service | Later, one hook in `promptpay/index.ts` |
| **Automatic, from the bank**: bill-payment QR (`billPaymentPayload`) carries the order number; the bank's webhook says which order was paid | a biller ID from the gym's business bank account | Later |
| **Payment gateway** (Opn, 2C2P): they make the QR and send a webhook | a merchant account, about 1.6% per payment | Later, if volume justifies it |

### Setup
1. Admin → Site & content → Business → **PromptPay number**: the gym's mobile number, 13-digit tax ID or 15-digit e-wallet ID (or set the `PROMPTPAY_ID` secret on the edge functions).
2. SQL editor → paste `supabase/payments.sql` → Run (after `customer-app.sql`).
3. Edge functions: add `promptpay` (it uses `_shared/promptpay.ts` and `_shared/http.ts`).
4. Upload `lib/payments/promptpay.ts` into `src/lib/payments/`.
5. **Test with real money once**: ฿1 from a phone, check the name shown in the bank app before confirming is the gym's.

### Lovable prompts

#### 7. Pay by QR in the app

> When a customer orders from `/app/menu`, after **Order for pickup** show a choice: **Pay now with QR** or **Pay at the counter**. Pay now calls the edge function `promptpay` `{ action: 'create', orderId }` and opens `/app/pay/:intentId`.
> `/app/pay/:intentId`, same style as the pass: eyebrow "ORDER <reference>", title "SCAN TO PAY", a white card with the PromptPay logo text, the amount in the display font, the QR of `qrPayload` (use the `qrcode` package, error correction M, at least 240px, white quiet zone), "To Superfit · <formatPromptPayId(promptPayId)>", and a countdown to `expiresAt`. Under it: "Open your bank app, scan, and pay the exact amount." Button **Save QR to photos** (so they can open it from their bank app on the same phone).
> Subscribe with Supabase Realtime to `payment_intents` where `id = intentId`, and also poll `{ action: 'status' }` every 5 s as a fallback. On `paid`: a green tick, "Paid. Your order is with the bar.", then go to the order page. On `expired`: "This code has expired" with **Get a new code** (`create` again) and **Pay at the counter** (`cancel`).
> Button **I've paid: scan my slip**: opens the camera (BarcodeDetector, fallback `jsqr`) or lets them pick the slip screenshot from photos, reads the small QR on the slip, uploads the image to the `payment-slips` bucket at `<user id>/<intentId>.jpg`, then calls `{ action: 'slip', intentId, slipQr, slipImagePath }`. Show the error message from the function as is (it explains when they scanned the wrong QR). On success show "Slip sent. We'll confirm in a moment." in amber.

#### 8. Confirm QR payments at the desk

> 1. **Payments** panel on the check-in screen and the bar board: rows from the `open_payments` view, live via Realtime on `payment_intents`. Each row: reference, member name, amount in big digits, time ago, and a status pill (amber "Waiting", blue "Slip sent" with the bank name, grey "Expired"). Tapping a row with a slip opens the slip image (signed URL from `payment-slips`). Big green **Confirm paid** calls `promptpay` `{ action: 'confirm', intentId }`; **Cancel** calls `cancel`. Play the check-in success sound when a row turns into "Slip sent".
> 2. **Till QR payments:** when staff choose QR at the till, call `{ action: 'create', amount, reference: ticketNumber, memberId }` and show the returned `qrPayload` large on the customer-facing side, with the same live status; **Confirm paid** finishes the sale only after `confirm` succeeds.
> 3. Only staff ever see **Confirm paid**. Never mark a QR order paid anywhere else; the database trigger marks the cafe order paid when the payment is confirmed.

## Later

- Pay for renewals in the app: add a `membership` purpose to `payment_intents` that creates the membership when confirmed.
- Automatic slip checks or bill-payment webhooks (see the table in Thai QR payments).
- Rotating pass codes (time-based) if sharing passes becomes a problem. The tag code is just as shareable today, so start simple.
- LINE login as a custom OIDC provider.
- Push notifications for "3 days left" (the reminder rules already exist in `lib/membership/reminders.ts`).
