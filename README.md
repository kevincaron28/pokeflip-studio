# Cardstead (formerly PokéFlip Studio) v4.3 — Hosted collection and resale workbench

**App:** https://pokeflip-studio.vercel.app  
**Source:** https://github.com/kevincaron28/pokeflip-studio

Price checks and alerts for Pokémon TCG collectors in Canada (EN/FR). Look up card and sealed-product prices in CA$ with their sources and confidence, keep a light list of your cards with target prices (**My cards**), get drop alerts from Canadian shops, and spot eBay.ca listings under value. Prices are estimates: always check before you buy or sell.

## New in v3.5
- **TCGdex pricing context:** once an exact card is selected, display available USD TCGplayer and EUR Cardmarket quotes for the selected finish, with timestamps and stale-data warnings. This is informational only, not eBay/CAD resale valuation.
- **Paginated inventory browsing:** display 100 rows at a time, search the full inventory and load more without creating thousands of rows in the page. Verified using 1,200 simulated inventory entries.
- Optional **automatic cloud backup while the app is open** once you have signed in and completed an initial manual upload/download.
- Every automatic save uses an optimistic revision check. If another device changes the cloud snapshot, automation disables itself and requires you to reconcile; no silent overwrite.
- eBay comparable sales and imported restock alerts now trigger the same changed-data signal as inventory edits.
- Browser acceptance tests simulate first upload, auto-upload, and a concurrent-device conflict. These tests use a fake Supabase client, not real network auth.

## Getting started
1. **Prices:** search a card or sealed product, open it, check its CA$ value, sources and confidence. **All sets** lists every set.
2. **My cards:** tap **Add a card**, search, pick the exact card and printing, optionally add a grade, what you paid, a target price and an "X% under value" alert level. Cards at or under your target are flagged and notified; cards with a target or alert level are also checked by **eBay deals**.
3. **Drops:** watch sealed products at Canadian shops; turn on drop alerts in Settings.
4. For cloud backup open **Settings**, sign in with email, then Upload your local data to the empty account or Download any existing cloud snapshot. Export JSON backups regularly.

## Limitations
- You pick the exact card from the TCGdex catalogue (set and number); Cardstead does not identify cards from photos. The camera scanner was removed on 25 November 2026.
- Card prices come from recent TCGplayer and Cardmarket sales (converted at the Bank of Canada rate); graded cards have no sold-price source and are compared with eBay.ca asking prices only.
- Live eBay Product Research sold history requires authorized source access; current comparable sale entry is manual. Do not use active asking prices as verified sales.
- Regional restock alerts are currently user imports/watchlists and external provider links; they are not a continuous authorized server monitor.
- Cloud email signup/OTP and two real devices still require end-to-end acceptance. No automated sync runs while the tab is closed.
- A dedicated Canadian Supabase project is configured with owner-only RLS and revision-controlled writes; review [SECURITY.md](SECURITY.md) before public multi-user launch.

## Tests
Run `npm run check`, `python tests/browser_embedded.py`, and `python tests/cloud_autosave_browser.py` (Playwright + Chromium required). See [release status](RELEASE-STATUS.md) and [GitHub issues](https://github.com/kevincaron28/pokeflip-studio/issues).

## Deployment
The existing Vercel project hosts https://pokeflip-studio.vercel.app. Production source can be deployed directly from a chosen GitHub SHA. Installing and authorizing Vercel's GitHub integration is still needed for automatic push-to-deploy. Preview protection is enabled, production frontend public; inventory requires Supabase account authentication.

Moving off Vercel Hobby (non-commercial only): the site is ready for Cloudflare Pages (free, commercial use allowed). `node tools/build-pages.mjs` builds `dist/`, `functions/` holds the eBay route and the security headers, and `npm run pages:dev` runs it locally. Setup, side-by-side run and the cut-over checklist: [docs/CLOUDFLARE-MOVE.md](docs/CLOUDFLARE-MOVE.md).

## Collaboration
Read [AGENTS.md](AGENTS.md) and the [architecture](docs/ARCHITECTURE.md) first. Use feature branches and PRs with tests, and never commit personal data or service-role keys.

## Android app (Capacitor)
`mobile/` wraps this web app as an Android app (offline assets, local notifications, `top.kcaron.cardstudio://auth` sign-in return). The website stays the web backup. See [docs/ANDROID.md](docs/ANDROID.md) for build, CI, signing secrets and Supabase redirect URLs, and [docs/PLAY-STORE-READINESS.md](docs/PLAY-STORE-READINESS.md) for Play Store prerequisites (including a name/trademark risk). Not yet verified on a device.
