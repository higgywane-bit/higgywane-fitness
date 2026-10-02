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

## Where things live

- `content/`: prices (`pricing.json`), ingredients + macros, option groups, menu recipes. Edit data here, not in components.
- `lib/nutrition.ts`: pure price/macro maths. `lib/payments/`: provider interface, mock provider, PromptPay QR payload.
- `public/brand/`: recreated SVG logo (white/black, wordmark + star).

## Placeholders to confirm

Search the code for `TODO: confirm with`: recipes and macros, add-on prices, product photos, PromptPay ID, payment provider, opening hours, logo vector, Adobe kit.

In test mode, PromptPay payments confirm after about 6 seconds; a customer name containing "decline" simulates a failed payment.
