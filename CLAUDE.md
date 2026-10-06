# Superfit Thailand — web app

Mobile-first web app for **Superfit**, a bodybuilding gym + cafe in Thailand.
Goal: the cleanest, most premium, most interactive gym site possible — app-like on phones.

## Read first
- `docs/PLAN.md` — the full spec: stack, design direction, routes, feature specs, data models, build sessions. Follow it.
- `content/pricing.json` — real prices (memberships, PT, cafe) supplied by the owner. Source of truth; never hard-code prices in components.
- `docs/ADMIN-PLAN.md` — admin blueprint: modules, dashboard module catalogue, metric definitions, data model, integration contracts, Lovable handoff, roadmap.
- `docs/PT-APP.md` — PT client app (`/app`) + coach portal (`/coach`): till → coach → client connection, screens, data model, rules, super1 brand tokens, Lovable handoff.
- `docs/MEMBERSHIP.md` — the membership system / admin (`/admin`) that replaces Glofox: check-in, members, Glofox import, Qashier sales, reminders.
- `brand/reference/` — logo, the "SUPERCOACH TEAM" poster (coaches Bella, Nicha, Aun, Poom), and the owner's favourite font (Avenir Next LT Pro Heavy Condensed).

## Priorities
1. **Cafe ordering** is the centrepiece: slick grid → product bottom sheet → add-ons/removals with live price **and macros** → cart with full macro breakdown → checkout with payment method choice (mock provider for now; PromptPay QR, Apple Pay, Qashier terminal later).
2. **Coaches**: rotating full-bleed portraits → shared-element transition into rich profile pages.
3. **Train**: memberships + PT pricing with savings computed from data.
4. **Admin** (`/admin`): members database + front-desk check-in. Membership rules stay in the pure functions in `lib/membership/access.ts`; never re-derive days left or status in components. Dashboard figures are defined once in `lib/dashboard/data.ts` (definitions in `docs/ADMIN-PLAN.md` §4); new dashboard modules go in `lib/dashboard/catalog.ts` + `LOADERS` + `RENDERERS`.

5. **PT app** (`/app` clients, `/coach` coaches, super1 brand `--s1-*` tokens): plan, macro, feedback and progress rules live in the pure functions in `lib/pt/`; sessions left always comes from `memberStanding()`. Never re-derive in components.

## Conventions
- Next.js App Router + TypeScript (strict) + Tailwind v4 + shadcn/ui + Motion + Embla + Vaul + Zustand.
- Design mobile first at 375px, then 768 / 1024 / 1440. 44px touch targets, 4.5:1 contrast, visible focus, `prefers-reduced-motion`.
- Black/white brand, one red accent, display font via `--font-display` (Adobe Fonts kit when available, Barlow Condensed fallback).
- SVG icons (Lucide) only — no emoji icons.
- All content (menu, ingredients, macros, option groups, coaches) lives in `content/` as typed data; components only render it. Placeholder data is marked `// TODO: confirm with cafe` / `// TODO: confirm with owner`.
- Prices are THB, formatted `฿1,200`. Macro and price maths lives in pure functions in `lib/` with unit tests.
- Use the installed design skills (ui-ux-pro-max, frontend-design, taste-skill) and the 21st.dev MCP for component inspiration (free tier: only 2 code retrievals/day — use sparingly). Verify UI with the Playwright MCP at mobile and desktop widths.
- Work on the session's designated branch; commit in small, clear steps.
