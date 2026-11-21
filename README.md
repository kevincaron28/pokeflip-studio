# PokéFlip Studio

A mobile-first Pokémon TCG collection and resale workbench focused on **Canadian dollars**, **French/English cards**, **bulk purchases**, and **true resale profitability**.

**Hosted app:** https://pokeflip-studio.vercel.app  
**Source:** https://github.com/kevincaron28/pokeflip-studio  
**Status:** Deployed release candidate, **not fully production-validated**. See [RELEASE-STATUS.md](RELEASE-STATUS.md) and [open issues](https://github.com/kevincaron28/pokeflip-studio/issues).

## What works now

- Purchase lots, bulk quantity entry, individual inventory, storage boxes, sales, expenses and true realized profit.
- Portfolio dashboard with invested capital, estimated resale value, pricing coverage, eBay comparisons and lot recovery.
- OCR-assisted English/French card lookup and exact set + collector-number search, reference-based symbol matching and manual finish/condition review.
- Conservative grade-potential screening (not a PSA grade predictor).
- Sealed products comparison, CAD landed cost and Buy-or-Pass calculator.
- Québec/Montérégie restock watchlists, external source links and manually imported/deduplicated alerts.
- JSON backup/restore, CSV exports, mobile-capable PWA shell.
- Dedicated Supabase project for optional **explicit** cloud upload/download with account ownership and conflict protection.

## Important limitations

- **Camera recognition is not accuracy-certified.** Confirm exact expansion, number, symbol, language, foil finish and condition; uncertain cards go to Review.
- **eBay sold prices are not automatically imported.** Use verified eBay Product Research/sold comparable entries; active asking prices are not actual sales.
- **Continuous third-party restock monitoring is not active.** Alerts are imported manually or followed through the source provider until licensed, server-side integrations are built.
- **Cloud synchronization is manual** and cross-device sign-in/restore has not yet passed real-device acceptance. Export a JSON backup before replacing local data.
- Browser tests cover simulated mobile interactions, not real Pixel camera focus or actual card conditions.

## Run checks

Node.js 22+ is recommended:

```bash
npm run check
```

The included GitHub Actions workflow runs JavaScript tests and a simulated Chromium UI test. A passing local test is not a substitute for live user-device acceptance.

## Deployment

The site is deployed from GitHub source to the existing Vercel project `pokeflip-studio`; current production URL: https://pokeflip-studio.vercel.app.

**Automatic GitHub push-to-deploy is not yet set up** because Vercel's GitHub integration must be installed/authorized for this repository. See [issue #5](https://github.com/kevincaron28/pokeflip-studio/issues/5).

Cloud account login uses dedicated Supabase Canada Central. Configure the production URL as an allowed auth redirect before testing email links. Do not put secret/service-role keys in this repository; the frontend uses a public publishable key only.

## For collaborators and coding agents

Read [AGENTS.md](AGENTS.md), [architecture](docs/ARCHITECTURE.md), and [the open issues](https://github.com/kevincaron28/pokeflip-studio/issues) before editing. Work from branches and PRs, keep identity and profit calculations conservative, add tests, and protect user data.

## First bulk purchase

See [FIRST-BULK-PURCHASE.md](FIRST-BULK-PURCHASE.md). Do not base a buying decision solely on unverified scan results or projected portfolio values.
