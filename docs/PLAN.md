# Superfit Thailand — Web App Plan

Mobile-first, app-like website for Superfit (bodybuilding gym + cafe).
Three things have to feel exceptional: the **cafe menu and ordering**, the **coaches**, and **pricing** (memberships + PT).
All content is data-driven — prices, products, add-ons and coach bios live in `content/` and can be edited without touching layout code.

---

## 1. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | Static pages for speed, server actions later for real orders |
| Styling | **Tailwind CSS v4** + CSS variable design tokens | Fast, consistent, easy theming |
| Components | **shadcn/ui** (Radix) + selected **21st.dev** pieces | Accessible primitives we own and restyle |
| Motion | **Motion** (framer-motion) | Shared-element transitions (coach card → profile), sheet gestures |
| Carousel | **Embla Carousel** | Swipe, autoplay, snap — for the coach rotator and pricing rails |
| Bottom sheets | **Vaul** | Native-feeling product detail sheet on mobile |
| Cart state | **Zustand** + `persist` (localStorage) | Tiny, survives reloads |
| i18n | **next-intl**, English first, Thai-ready | Add Thai later without restructuring |
| Images | `next/image` (AVIF/WebP, blur placeholders) | Coach photos must be sharp and fast |
| Testing | **Playwright** (MCP + specs) at 375 / 768 / 1024 / 1440 | Visual + flow checks |
| Hosting | **Vercel** | Zero-config Next.js, preview URL per branch |

---

## 2. Design direction

Brand references live in `brand/reference/`:
- `logo-white-on-black.jpg` — the Superfit star + lowercase "superfit" wordmark, white on black. Low-res: recreate it as a clean **SVG** (star mark + wordmark, white and black versions) and ask the owner for the original vector when possible.
- `supercoach-team-poster.jpg` — the existing "SUPERCOACH TEAM — Train with us!" poster: black background, white heavy italic condensed headings, a red handwritten script accent, the four coaches in black Superfit kit. Hashtag `#IAMSUPERFIT`.
- `font-avenir-next-heavy-condensed.png` — the owner's favourite typeface ("absolute GOAT of fonts").

- **Mood:** premium, dark, athletic, confident. "High-end supplement brand", not "loud gym flyer". Black and white first; photography provides the colour.
- **Colour:** true black base (`#000` / `#0A0A0A`), raised surfaces (`#141414`, `#1C1C1C`), white text, hairline borders `rgba(255,255,255,.08)`. **One accent: Superfit red** (from the poster script, approx `#E11D48` — tune against the poster) for CTAs, prices, badges, active states. Success green only for macro/progress UI. Optional light mode for the cafe menu.
- **Type:**
  - Display: **Avenir Next LT Pro Heavy Condensed** (+ Heavy Condensed Italic for hero lines, like the poster). It's an Adobe Fonts typeface — load it via the owner's **Adobe Fonts web kit** (`NEXT_PUBLIC_ADOBE_FONTS_KIT` env var / Typekit `<link>`). Until a kit ID exists, fall back to self-hosted **Barlow Condensed 800/900** (closest free match) through one `--font-display` variable, so switching is a one-line change.
  - Body: **Avenir Next LT Pro** Regular/Demi from the same kit, fallback **Inter**.
  - Uppercase italic for big statements ("TRAIN WITH US"), big tabular numerals for prices and macros.
  - Optional red handwritten script accent (e.g. a signature-style font) used at most once per screen, echoing the poster.
- **Layout:** 4px spacing grid, 16px mobile gutters, 20–24px card radius, generous whitespace, real photography doing the heavy lifting.
- **Motion:** 200–300ms ease-out, spring for sheets/drag; respects `prefers-reduced-motion`.
- **Rules (from UI UX Pro Max / taste):** SVG icons only (Lucide), 44px min touch targets, 4.5:1 contrast, visible focus, no layout shift, no generic AI gradients.

---

## 3. Information architecture

Mobile bottom tab bar (thumb zone), becomes a top nav on desktop:

```
[ Home ]  [ Cafe ]  [ Coaches ]  [ Train ]  [ Cart • n ]
```

| Route | Purpose |
|---|---|
| `/` | Home — hero, coach rotator teaser, cafe highlights, membership CTA, location/hours |
| `/cafe` | Full menu: sticky category chips + product grid |
| `/cafe/[product]` | Deep-linkable product (opens as bottom sheet over `/cafe` on mobile, page on direct visit) |
| `/coaches` | Full-screen rotating coach showcase |
| `/coaches/[slug]` | Coach profile — Bella, Nicha, Aun, Poom |
| `/train` | Memberships + Personal Training pricing |
| `/cart` → `/checkout` | Cart drawer, then order confirmation |

---

## 4. Feature specs

### 4.1 Cafe menu & ordering (the centrepiece)

**Menu page**
- Sticky header with search + horizontally scrolling **category chips** (Smoothies · Juices · Coffee · Performance). Chips scroll-spy the active section; tapping smooth-scrolls.
- **Product grid:** 2 columns on mobile, 3 on tablet, 4 on desktop. Card = square image, name, one-line description or ingredient pills, price ("from ฿149"), and a round **+** button for quick-add.
- Empty categories (Performance today) render a tasteful "Coming soon" tile instead of disappearing.

**Product sheet** (tap a card) — must be the slickest part of the app
- Bottom sheet (drag to dismiss) on mobile, centred modal on desktop.
- Hero image, name, description, **ingredient list**, and a **live macro panel**: kcal (big number) + protein / carbs / fat as a segmented bar and grams, plus sugar and fibre.
- **Option groups**, data-driven, every option carries its own **price delta AND macro delta**:
  - *Single choice, required* — Size (Regular / Large), Hot/Iced, Single/Double shot, Base (water / milk / oat / almond).
  - *Multi choice, optional, with max* — Add-ons: whey scoop, plant protein, peanut butter, oats, creatine, collagen, banana, honey, extra shot.
  - *Remove ingredients* — toggles that subtract an ingredient's macros (e.g. no banana, no honey).
- Every tap animates the macro numbers and the price (count-up/down), so customers see "+24g protein · +฿40" instantly.
- Quantity stepper + note field ("less ice").
- Sticky footer button with **live total**: `Add to order · ฿189 · 412 kcal`.
- Item flies to the cart badge on add.

**Cart & checkout**
- Cart drawer: line items with chosen options and **per-line macros**, edit (reopens sheet with selections), qty, remove.
- **Order macro breakdown** at the top of the cart: total kcal, protein / carbs / fat ring or stacked bar, % split, so a member can see "this order = 62g protein".
- Checkout: name, phone/member ID (optional), pickup time (ASAP / slot), dine-in table or takeaway, note, **payment method** (see 4.5).
- Order confirmation screen with order number, status, macro summary.

**Data model** — macros are computed, never hand-typed per variant

```ts
type Macros = { kcal: number; protein: number; carbs: number; fat: number; sugar?: number; fibre?: number };

type Ingredient = { id: string; name: string; macros: Macros; allergens?: string[] };

type Option = {
  id: string; label: string;
  priceDelta: number;          // THB
  macroDelta?: Macros;         // added (or negative) macros
  ingredientId?: string;       // or derive macros from an ingredient
  multiplier?: number;         // e.g. Large = 1.4x base recipe
  default?: boolean;
};

type OptionGroup = {
  id: string; title: string;
  type: "single" | "multi" | "remove";
  required?: boolean; max?: number;
  options: Option[];
};

type MenuItem = {
  id: string; slug: string; category: "smoothies" | "juices" | "coffee" | "performance";
  name: string; description?: string;
  recipe: { ingredientId: string; grams?: number }[];   // base macros come from the recipe
  basePrice: number; priceIsFrom?: boolean;
  image?: string; badges?: string[]; tags?: ("high-protein" | "low-cal" | "vegan" | "caffeine")[];
  optionGroups?: string[];     // ids of reusable OptionGroups
  available?: boolean;
};

type CartLine = {
  id: string; itemId: string; qty: number;
  selections: Record<string, string[]>; note?: string;
  unitPrice: number; unitMacros: Macros;   // snapshot at add time
};
```

`lib/nutrition.ts` holds pure functions (`itemMacros(item, selections)`, `cartMacros(lines)`, `itemPrice(...)`) with unit tests. Option groups are defined once and attached to many items, so adding add-ons later is a one-line change. **Placeholder macros/recipes are fine for now — mark them `// TODO: confirm with cafe`.**

### 4.2 Coaches

**Rotator** (home teaser + `/coaches`)
- Full-bleed portrait cards (Bella, Nicha, Aun, Poom) in an Embla carousel: autoplay (pauses on touch/hover), swipe, peek of the next card, progress indicators.
- Subtle parallax on the image, name in large condensed type, specialty tag.
- Tap → **shared-element transition**: the card image expands into the profile hero.

**Profile page** `/coaches/[slug]`
- Hero: full-height portrait, name, title, specialties chips, primary CTA *Book PT with Bella* (links to PT packages, preselected coach).
- Quick stats strip: years coaching, competitions, clients trained, certifications.
- Bio sections (scroll-revealed): *About* · *Coaching philosophy* · *Specialties* · *Achievements / competition history* · *Certifications* · *Photo gallery* · *Client transformations / testimonials* · *Instagram link*.
- "Other coaches" rail at the bottom to keep browsing.

```ts
type Coach = {
  slug: string; name: string; title: string;
  portrait: string; gallery?: string[];
  specialties: string[];
  stats?: { label: string; value: string }[];
  bio: { heading: string; body: string }[];
  achievements?: string[]; certifications?: string[];
  testimonials?: { name: string; quote: string; image?: string }[];
  instagram?: string;
};
```

### 4.3 Train — Memberships & Personal Training

- **Memberships:** segmented control *Short term* (Day / 1W / 2W / 1M) vs *Commit & save* (3M / 6M / 12M). Cards show price, **monthly equivalent** and **saving vs paying monthly** (computed from data — values provided match: 3M saves ฿1,200, 6M ฿4,200, 12M ฿14,400). Badges "Popular" / "Best Value" highlight cards.
- **Personal Training:** 4 package cards with **price per session** and a "save ฿x vs single" line (3 → ฿100 off, 10 → ฿2,000, 20 → ฿7,000). Optional coach picker.
- CTA per card: *Enquire on LINE* / *Buy at front desk* in Phase 1; online purchase later.

### 4.4 Home

Hero (video or photo, one strong line, two CTAs: *Order from Cafe* / *Join Superfit*) → coach rotator → cafe favourites rail → membership highlight → location, hours, map, LINE/Instagram.

---

### 4.5 Payments (build the interface now, connect providers later)

Payment methods to support: **Thai QR / PromptPay**, **Apple Pay** (and Google Pay / cards), and the in-store **Qashier** terminal (used heavily today), plus *Pay at counter*.

- Build a provider-agnostic layer: `lib/payments/` with a `PaymentProvider` interface (`createPayment(order) → { status, qrPayload?, redirectUrl?, terminalRef? }`, `getStatus(id)`), and a **mock provider** that simulates success/failure so the full checkout UX works end to end now.
- Checkout UI: payment method cards (PromptPay QR shows a QR screen with countdown + "waiting for payment" state; Apple Pay button shown only where supported; "Pay at counter / Qashier terminal" sends the order with `unpaid` status).
- Candidates when connecting: **Opn Payments (Omise)** or **2C2P** cover PromptPay + Apple Pay + cards in Thailand; Qashier via its merchant/API integration if available, otherwise orders show on the counter and are charged on the terminal.
- Orders and payment state go through a server action / API route so secrets never reach the browser.

---

## 5. Project structure

```
app/
  (site)/layout.tsx         # shell: header, bottom tab bar, cart drawer
  (site)/page.tsx           # home
  (site)/cafe/page.tsx
  (site)/cafe/@sheet/...    # intercepting route → product bottom sheet
  (site)/cafe/[product]/page.tsx
  (site)/coaches/page.tsx
  (site)/coaches/[slug]/page.tsx
  (site)/train/page.tsx
  (site)/checkout/page.tsx
components/
  ui/                       # shadcn primitives
  layout/  cafe/  coaches/  pricing/  cart/
content/
  pricing.json              # source data as supplied
  menu.ts  options.ts  coaches.ts  # typed content built on top of it
lib/
  cart-store.ts  pricing.ts (savings, per-session, THB format)  nutrition.ts  payments/  i18n/
public/images/coaches/  public/images/menu/
tests/e2e/                  # Playwright
```

---

## 6. Build sessions

| # | Session | Outcome |
|---|---|---|
| 1 | **Foundation + Cafe** | Next.js scaffold, brand tokens, fonts, SVG logo, app shell (header + bottom tabs), typed content layer with ingredients + macros, menu grid with chips/scroll-spy, product sheet with options + live macros, cart with macro breakdown, checkout with mock payments |
| 2 | **Coaches** | Rotator, shared-element transition, profile template, 4 coach entries (placeholder bios until supplied) |
| 3 | **Train + Home** | Membership and PT pricing with computed savings, home page assembled |
| 4 | **Polish & ship** | Motion pass, empty/loading states, a11y + Lighthouse, Playwright flows at 4 breakpoints, Vercel deploy |
| 6 | **Admin & memberships** | Members database, front-desk check-in, Glofox import, Qashier sales, renewal reminders. See `docs/MEMBERSHIP.md` |
| 5 | **Real ordering** | Connect PromptPay / Apple Pay / Qashier, order notifications to staff, Thai translation |

---

## 7. Open questions

1. **Individual coach portraits** — coming later. Until then use `brand/reference/supercoach-team-poster.jpg` (crop per coach) or tasteful placeholders. Coach order left → right in the poster is assumed to be Bella, Nicha, Aun, Poom — **confirm with the owner**.
2. **Logo vector** (SVG/AI) — recreate from the JPG for now.
3. **Adobe Fonts kit ID** for Avenir Next LT Pro — fallback font until provided.
4. **Real recipes, macros, add-ons and prices** for the cafe — placeholders until supplied.
5. **Payment provider accounts** (Opn/Omise or 2C2P, Qashier details) — mock until then.
6. **Language** — English at launch, Thai-ready.
7. **Domain / hosting** — Vercel assumed.
