# super1 PT: client app + coach portal

Two apps on one database with the front desk:

- **Client app** at `/app`: a PT client's workouts, live set logging, history, nutrition and daily feedback, on their phone.
- **Coach portal** at `/coach`: each coach's clients, plus a workout, nutrition and feedback builder for each. Phone first, with a desktop layout that has the exercise library beside the plan.

Design source: the "super1.cloud PT: client app and coach portal" canvas (super1.world design system). Exercise library: `content/pt-library.json` (107 exercises, 30 cues, EN + TH).

---

## 1. How it connects (till → coach → client)

```
 Front desk (/admin)            Coach portal (/coach)              Client app (/app)
 ───────────────────            ─────────────────────              ─────────────────
 Sell PT pack + pick coach ──▶ client appears in "To set up" ──▶ email / LINE link
        │                         │  can build plans already          │
        │ onPtPackSold()          │                                   ▼
        ▼                         │                        /app/join/<token>: set password
 pt_clients (invited)             │                                   │
 invite token (sha-256 stored)    ◀── "Pete joined the app" ──────────┘ acceptInvite()
                                  │
 Coach edits workout / nutrition ─┼─ savePlan(): version +1, diff ──▶ "Bella updated your workout"
                                  │                                   notice on Home (refreshes on focus)
                                  ◀── "Pete finished Chest and Back #1" ── saveWorkout()
                                  ◀── "Pete completed daily feedback" ──── saveFeedback(complete)
 Log PT session (desk or coach) ──┴─ useSession(): sessions left goes down in both apps
```

1. **Desk sells a PT pack** (Admin › member › Sell PT pack, or new member + PT) and picks the coach. `sellPlanAction` calls `onPtPackSold()` (`lib/pt/service.ts`):
   - links the member to the coach (`pt_clients`, status `invited`), idempotent: a returning client keeps their history and moves to the new coach;
   - sends the invite email (Resend when `RESEND_API_KEY` + `EMAIL_FROM` are set, otherwise logged) and **always returns the link** so the desk can send it by LINE/SMS. The dialog shows it with a Copy button;
   - if the client is already on the app, they get a notice ("10 PT sessions added") instead.
2. **Coach** sees them under **Clients › To set up**, can build their plans straight away (no notices are sent until they join), and can resend a link (email, or a link for LINE/SMS). The coach can also **Add client** from any member with a PT pack.
3. **Client** opens the link, which works once and lasts 14 days, then sets a password and lands on Home. They move to **Clients › Active** and the coach gets "Pete joined the app".
4. **Every save** in the coach's editors bumps the plan version, works out what changed (`diffPlans`, `diffDiet`) and posts one notice to the client listing the changes. Unread notices for the same plan merge into one. The client app refetches on focus and every two minutes, so it shows up straight away (web push can be added later, see §7).
5. **Client activity flows back**: finished workouts (with notes) and completed daily feedback land in the coach's notifications and on the client's page.

**Forgot password** = the same link mechanism (`requestLoginHelp`), and it never reveals whether an email has an account. Setting a new password signs out the client's other devices.

---

## 2. Screens

### Client app (`/app`, phone-first, max width 448px)

| Route | Screen |
|---|---|
| `/app/login` | Email + password, "Forgot password?" emails a link |
| `/app/join/[token]` | "Hi Pete. Bella has set you up": choose password (or new password) |
| `/app` | Greeting, coach notices (dismiss / clear all), Workout now / My nutrition / Daily feedback (yellow until today is complete), sessions left, avg steps, weight; account sheet (language for cues EN/TH, sign out) |
| `/app/workout` | My gym days, numbered, "Last done …"; **Resume** banner if a workout is open on this phone |
| `/app/workout/[dayId]` | The day's exercises with targets, last time and coach cues; My history card; **Start** |
| `/app/workout/[dayId]/log` | Live logging: exercise cards, kg/reps (or time) pills, custom keypad (±2.5 kg, ±1 rep, Log set), tick → rest timer (beep + vibrate), add/remove set, note for the coach, End (finish / keep going / discard) |
| `/app/workout/session/[id]` | Workout done (`?done=1`) or any past session: kg lifted vs last time, sets, "Up on last time", every set, note |
| `/app/workout/[dayId]/history` | Kg lifted chart, best sets with progress, every session |
| `/app/nutrition` | kcal (from macros), macro split bar, P/C/F, coach note, daily meal plan |
| `/app/feedback` | Day switcher (14 days back), questions saved as you go, **Complete**; past days read-only with "Completed at 21:14". Today and the 2 days before can still be edited |

The workout in progress lives on the phone (`lib/pt/workout-store.ts`, localStorage) until Finish, so weak gym signal or a reload never loses sets.

### Coach portal (`/coach`)

| Route | Screen |
|---|---|
| `/coach/login` | Pick your name, enter staff PIN (same PIN as the admin "who's working") |
| `/coach` | **Clients**: Active / To set up / Archived, search, row line ("3 sessions left. Today's feedback not in"), unread dot, **Add client** |
| `/coach/clients/[id]` | Sessions left + **Log session** (trained / no-show / undo), invite card, Workout / Nutrition / Daily feedback rows, **What Pete sees** switches (instant), avg steps + weight, last 7 days of feedback, workouts logged (with notes), contact; ⋯ menu: archive / restore, move to another coach (owner/manager) |
| `…/workout` | **Workout editor**: day chips (+ Add day; rename, duplicate, reorder, delete), each exercise a drop-down: sets stepper, **Same for all sets** or **Edit each set**, reps/time steppers, cues (Form / Tempo / Effort, max 4, or write your own), free note, move up/down, remove. **Add exercise**: library sheet (phone, multi-select) or library panel beside the plan (desktop, one click). Custom exercises. **Programs**: load one, or save this workout as one. Sticky **Save and send to Pete** bar, then a toast listing what changed |
| `…/nutrition` | Macro steppers (5 g), kcal and split live, note, daily plan switch, meals as drop-downs (rename, foods + amounts, reorder, remove), load a saved diet |
| `…/feedback` | Question switches (steps, water, sleep, digestion, energy, bodyweight on by default; hunger and stress off), steps and water targets, add your own question (1 to 5, number, yes/no, short answer) |
| `…/feedback/[date]`, `…/workouts/[wid]` | Read-only day / session for the coach |
| `/coach/leads` | Leads the desk assigned to this coach (Active / Archived), call / LINE, set stage |
| `/coach/programs` | Workout programs and diets; `/coach/programs/new?kind=…`, `/coach/programs/[id]` edit, **Use for a client**, delete |

Phone: tab bar (Clients · Leads · Programs), header with notifications bell and account. Desktop (≥1024px): 248px sidebar with nav, notifications, coach card, EN/TH language for library and cues, and log out. Owners and managers see every coach's clients.

---

## 3. Data model (migration `drizzle/0003_pt_app.sql`)

| Table | Purpose |
|---|---|
| `pt_clients` | member ↔ coach link. `status` invited / active / archived, `invite_token_hash` + `invite_expires_at` (one-time link), `invite_sent_at`, `invite_channel`, `joined_at`, `visibility` jsonb (workouts, nutrition, dailyPlan, feedback, homeStats), `last_seen_at`. One per member |
| `client_accounts` | app sign-in: `member_id` (unique), `email` (unique, case-insensitive), `password_hash` (scrypt), `lang` |
| `auth_sessions` | signed-in devices for both apps: sha-256 of the cookie token, `kind` client/coach, `subject_id`, `expires_at` (client 90 days, coach 30) |
| `pt_plans` | JSON docs: `kind` workout / diet / feedback. With `client_id` = that client's live plan (unique per kind); without = a coach's program. `version` goes up every save |
| `pt_library_items` | a coach's custom exercises and cues |
| `workout_logs` | finished workouts: `entries` jsonb (every set), note, `volume_kg`, `sets_done`, `plan_version` |
| `daily_feedback` | one row per client per day: `answers` jsonb, `completed_at` |
| `pt_notifications` | in-app notices, `audience` client or coach: plan.updated, pack.added, invite.accepted, workout.done, feedback.done |

Sessions left is **never stored on the PT side**: it comes from the desk's PT pack via `memberStanding()` in `lib/membership/access.ts`, so the desk, coach and client always agree. Logging a session from the coach portal calls the same `useSession()` as the desk, credited to the coach (it counts for commission in Coaching / Performance).

Document shapes (all validated server-side by `sanitize*` before saving):

```ts
WorkoutPlan  = { v: 1, days: [{ id, name, exercises: [{ uid, exerciseId, name, log: "weight_reps"|"reps"|"time",
                 sets: [{ reps? , seconds? }], cues: [{ id, en, th? }], note? }] }] }
DietPlan     = { v: 1, protein, carbs, fat, showDailyPlan, meals: [{ id, name, foods: [{ id, name, amount }] }], note? }
FeedbackSetup= { v: 1, questions: [{ id, label, type: number|choice|stepper|rate|yesno|text, unit?, target?, enabled, builtin }] }
WorkoutLog   = { dayId, dayName, startedAt, finishedAt, note?, entries: [{ uid, exerciseId, name, log, sets: [{ weight?, reps?, seconds?, done }] }] }
```

---

## 4. Rules (pure functions, unit tested)

| File | What |
|---|---|
| `lib/pt/library.ts` | Library + cues typed from JSON, search, merge custom items, validate custom exercises/cues |
| `lib/pt/program.ts` | Every workout edit (days, exercises, set count, same-for-all / per-set targets, steppers, cues, notes), summaries ("4 × 8", "12, 10, 8, 8", "20 min"), `sanitizePlan`, `diffPlans` |
| `lib/pt/diet.ts` | kcal = 4·P + 4·C + 9·F, macro split, meal/food edits, `sanitizeDiet`, `diffDiet` |
| `lib/pt/feedback.ts` | Questions, answer validation per type, formatting, 7-day averages, latest weight, streaks, day status |
| `lib/pt/progress.ts` | Volume, best set, "last time", prefill a workout from plan + history, "up on last time", day history, `sanitizeLog` |
| `lib/pt/clients.ts` | Client sections, row text, visibility, initials, dates |
| `lib/pt/auth.ts` | scrypt passwords, tokens, sessions |
| `lib/pt/service.ts` | All DB writes: link, invite, join, login, plans, programs, library, workouts, feedback, notices |
| `lib/pt/queries.ts` | Read models for the screens |

Rules that must survive any rewrite:
- Calories are always calculated from the macros, never typed in.
- Invite links are random, stored only as a hash, single use, 14 days, and a new link replaces the old one.
- A coach only reaches their own clients (`clientForCoach`); owners and managers reach everyone.
- Clients only touch their own data; switched-off parts (visibility) are refused server-side too.
- Saving a plan with an out-of-date `version` is refused ("changed on another device").
- Logged workouts and feedback are validated and clamped on the server; feedback can be edited for today and the 2 days before.
- Unread "updated" notices for the same plan merge into one.
- 5 wrong PINs or passwords lock that coach or email for 5 minutes (`lib/pt/throttle.ts`). In production a coach without a PIN can't sign in.

---

## 5. Brand

super1.world tokens are in `app/globals.css` as `--s1-*` (Tailwind: `bg-s1-surface-2`, `text-s1-blue`, …), scoped to the PT apps via the `.s1` class, so the Superfit site and admin are unchanged.

- Pure black ground. Surfaces `#0f1115` / `#1e2228` / `#2a2f37` / `#3a404a`, hairlines at 8% white.
- **Electric blue `#00b4ff`** for the one primary action, selection and focus, with black text on blue (white fails contrast).
- **Pink `#ff4edb`** for PT and coaches. **Yellow** = needs attention. **Green** = done. **Red** = ended or destructive.
- Inter + Noto Sans Thai; radii 12 (controls) / 16 (tiles) / 20 (cards) / 28 (sheets); 44px minimum touch targets.

The UI kit is `components/pt/ui.tsx` (Button, Row, Group, Card, Pill, Stat, TopBar, Dock, Wordmark) and `components/pt/controls.tsx` (Stepper, Switch, Segmented, Sheet, Collapsible, Toaster, SaveBar).

---

## 6. Demo

Local runs seed demo PT data: each coach has clients on the app (4-day plan, nutrition with meals, 6 weeks of logged workouts, 10 days of feedback), one in "To set up", a program, a diet and two leads. **Settings › Remove demo data** clears all of it.

- Coach portal: `/coach/login`, then tap any coach (demo coaches have no PIN locally).
- Client app: `/app/login` with a demo client's email (shown in Contact on their coach page) and password `superfit1`.

---

## 7. Handing over to Lovable

Keep unchanged and copy across: `drizzle/0003_pt_app.sql` (run after 0000–0002 on Supabase), `content/pt-library.json`, `content/pt-app.ts`, `lib/pt/{library,program,diet,feedback,progress,clients}.ts` with `tests/unit/pt.test.ts`. These have no Next.js in them.

Rebuild in Lovable: screens (match this app, the canvas and the tokens in §5), server actions (`app/coach/actions.ts`, `app/app/actions.ts`) as Supabase Edge Functions calling the `lib/pt/service.ts` functions, and auth:

- **Supabase Auth** replaces `auth_sessions` and `client_accounts.password_hash`. Clients use email + password or a magic link. Map `auth.users.id` to `client_accounts.member_id` and to `staff.id` for coaches. Keep the invite-token flow for the first sign-in.
- **Row-level security:** a client reads and writes only rows whose `pt_clients.member_id` is theirs (`daily_feedback`, `workout_logs`, client notices) and reads their `pt_plans`. A coach reads and writes `pt_clients` where `coach_id = auth.uid()` and everything under those clients. Owners and managers see all.
- **Realtime:** subscribe the client app to `pt_notifications` and `pt_plans` for their client id, so updates appear instantly. Add web push (or LINE OA) on `pt_notifications` insert.

**Next:** web push / LINE notifications, a PT calendar (booking slots, reminders), progress photos and measurements, chat, a full Thai UI (cue and library Thai is already in place), and video demos per exercise.
