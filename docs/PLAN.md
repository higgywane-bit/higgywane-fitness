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

## 2. Design direction (draft — confirm with brand assets)

- **Mood:** premium, dark, athletic, calm. "High-end supplement brand", not "loud gym flyer".
- **Colour:** near-black base (`#0B0B0C`), raised surfaces (`#151517`), off-white text, **one** accent used sparingly for CTAs/prices/badges (energy orange `#F97316` until the logo colours arrive). Optional light mode for the cafe menu.
- **Type:** *Barlow Condensed* (uppercase display headings, prices) + *Inter* or *Barlow* (body). Large, confident numerals.
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

**Product sheet** (tap a card)
- Bottom sheet (drag to dismiss) on mobile, centred modal on desktop.
- Hero image, name, description, ingredient pills, macros (optional: kcal / protein).
- **Option groups**, data-driven:
  - *Single choice, required* — e.g. Size (Regular / Large +฿40), Hot/Iced, Single/Double.
  - *Multi choice, optional, with max* — e.g. Add-ons: extra protein scoop, oat/almond milk, extra shot, peanut butter, sweetness level.
- Quantity stepper + note field ("less ice").
- Sticky footer button with **live total**: `Add to order · ฿189`.
- Haptic-style micro-animation: item flies to cart badge.

**Cart & checkout**
- Cart drawer: line items with chosen options, edit (reopens sheet), qty, remove, subtotal.
- Checkout: name, pickup time (ASAP / slot), dine-in table or takeaway, note.
- Phase 1 ends at an order summary screen. Phase 2 connects real fulfilment (see open questions).

**Data model**

```ts
type OptionGroup = {
  id: string; title: string;
  type: "single" | "multi";
  required?: boolean; max?: number;
  options: { id: string; label: string; priceDelta: number; default?: boolean }[];
};

type MenuItem = {
  id: string; slug: string; category: "smoothies" | "juices" | "coffee" | "performance";
  name: string; description?: string; ingredients?: string[];
  basePrice: number;           // "price" or "price_from"
  priceIsFrom?: boolean;
  image?: string; badges?: string[];
  macros?: { kcal?: number; protein?: number };
  optionGroups?: string[];     // ids of reusable OptionGroups
  available?: boolean;
};

type CartLine = { itemId: string; qty: number; selections: Record<string, string[]>; note?: string; unitPrice: number };
```

Option groups are defined once (e.g. `smoothie-size`, `protein-boost`, `milk`, `coffee-temp`) and attached to many items, so adding add-ons later is a one-line change.

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
  cart-store.ts  pricing.ts (savings, per-session, THB format)  i18n/
public/images/coaches/  public/images/menu/
tests/e2e/                  # Playwright
```

---

## 6. Build sessions

| # | Session | Outcome |
|---|---|---|
| 1 | **Foundation + Cafe** | Next.js scaffold, tokens, fonts, app shell (header + bottom tabs), typed content layer, menu grid with chips/scroll-spy, product sheet with options, cart store + drawer |
| 2 | **Coaches** | Rotator, shared-element transition, profile template, 4 coach entries (placeholder bios until supplied) |
| 3 | **Train + Home** | Membership and PT pricing with computed savings, home page assembled |
| 4 | **Polish & ship** | Motion pass, empty/loading states, a11y + Lighthouse, Playwright flows at 4 breakpoints, Vercel deploy |
| 5 | **Real ordering** | Payment / order routing per decision below, Thai translation |

---

## 7. Open questions

1. **Coach photo(s)** — the group photo didn't come through; individual portraits are ideal (vertical, high-res).
2. **Logo + brand colours** — or approve the dark + orange direction above.
3. **Where do cafe orders go?** e.g. LINE message to staff, kitchen tablet screen, PromptPay QR payment, or Grab/Lineman links.
4. **Add-ons & sizes** — list with prices (protein scoop, milk alternatives, sizes for smoothies/juices).
5. **Language** — English only at launch, or English + Thai.
6. **Domain / hosting** — OK with Vercel?
