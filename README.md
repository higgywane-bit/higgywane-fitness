# Superfit Thailand

Mobile-first web app for Superfit gym + cafe. See `CLAUDE.md` and `docs/PLAN.md`.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests (price + macro maths, payments)
npm run e2e        # Playwright ordering flows at 375px and 1440px
npm run typecheck && npm run lint
```

Optional env:

- `NEXT_PUBLIC_ADOBE_FONTS_KIT`: Adobe Fonts kit ID. When set, display/body switch to Avenir Next LT Pro; otherwise Barlow Condensed + Inter.

## Admin (`/admin`)

The Superfit back office that replaces Glofox:

- **Today:** dashboard (modules you switch on/off), front-desk check-in (USB scanner, iPad camera, typed code), live cafe order board
- **People:** members (status, at-risk, tags, notes, passes), leads pipeline, coaching (PT requests, sessions by coach), messages to segments
- **Business:** performance (profit and loss, churn, renewals, cohorts, targets), Qashier sales, expenses, Insights for uploaded Glofox reports
- **Team:** staff, PIN "who's working" with clock in/out, rota and hours
- **System:** activity log (who did what), settings, CSV exports

Members get a QR pass at `/pass/<secret>`. Design and rollout: `docs/MEMBERSHIP.md`. Full blueprint, metric definitions and Lovable handoff: `docs/ADMIN-PLAN.md`.

Locally it runs on PGlite (Postgres in `.data/`) preloaded with demo data for every screen (demo Owner PIN: 1234; remove it all from Settings). For production set `DATABASE_URL` and run `npm run db:migrate`. After changing `lib/db/schema.ts`, run `npm run db:generate`. See `.env.example` for all settings.

## Where things live

- `content/`: prices (`pricing.json`), ingredients + macros, option groups, menu recipes. Edit data here, not in components.
- `lib/nutrition.ts`: pure price/macro maths. `lib/payments/`: provider interface, mock provider, PromptPay QR payload.
- `lib/membership/`: access rules (days left, renewals, pauses), check-in and plan services, Glofox import, reminders. `lib/db/`: schema, client, demo seed. `content/plans.ts`, `content/gym.ts`: plan lengths and desk rules.
- `public/brand/`: recreated SVG logo (white/black, wordmark + star).

## Placeholders to confirm

Search the code for `TODO: confirm with`: recipes and macros, add-on prices, product photos, PromptPay ID, payment provider, opening hours, logo vector, Adobe kit.

In test mode, PromptPay payments confirm after about 6 seconds; a customer name containing "decline" simulates a failed payment.
