# PokéFlip Studio v3.5 — Hosted collection and resale workbench

**App:** https://pokeflip-studio.vercel.app  
**Source:** https://github.com/kevincaron28/pokeflip-studio

A mobile-first inventory and Pokémon resale tracker for bilingual Canadian collectors. Record bulk purchases, scan and review card identities, track eBay comparable sales, and compare sealed-product prices. This is a deployed application, but several real-device and external-data validation gates remain open.

## New in v3.5
- **TCGdex pricing context:** once an exact card is selected, display available USD TCGplayer and EUR Cardmarket quotes for the selected finish, with timestamps and stale-data warnings. This is informational only, not eBay/CAD resale valuation.
- **Paginated inventory browsing:** display 100 rows at a time, search the full inventory and load more without creating thousands of rows in the page. Verified using 1,200 simulated inventory entries.
- Optional **automatic cloud backup while the app is open** once you have signed in and completed an initial manual upload/download.
- Every automatic save uses an optimistic revision check. If another device changes the cloud snapshot, automation disables itself and requires you to reconcile; no silent overwrite.
- eBay comparable sales and imported restock alerts now trigger the same changed-data signal as inventory edits.
- Browser acceptance tests simulate first upload, auto-upload, and a concurrent-device conflict. These tests use a fake Supabase client, not real network auth.

## Getting started
1. Open the hosted site and create a purchase lot.
2. Bulk-enter commons by language and quantity; scan cards worth investigating individually.
3. For cloud backup open **Settings**, sign in with email, then Upload your local data to the empty account or Download any existing cloud snapshot.
4. Optionally enable automatic cloud backup while the app is open. Do not keep two editing tabs with unsynced changes. Export JSON backups regularly.
5. Before buying a collection, use Buy or Pass and independently verify card identities and sold-price evidence.

## Limitations
- Card matching is **OCR and reference-assisted**, not validated to reliably auto-identify every expansion, foil type, or special variant. Errors go to Review.
- Card grade potential is a screening aid, not a PSA grade or financial guarantee.
- Live eBay Product Research sold history requires authorized source access; current comparable sale entry is manual. Do not use active asking prices as verified sales.
- Regional restock alerts are currently user imports/watchlists and external provider links; they are not a continuous authorized server monitor.
- Cloud email signup/OTP and two real devices still require end-to-end acceptance. No automated sync runs while the tab is closed.
- A dedicated Canadian Supabase project is configured with owner-only RLS and revision-controlled writes; review [SECURITY.md](SECURITY.md) before public multi-user launch.

## Tests
Run `npm run check`, `python tests/browser_embedded.py`, and `python tests/cloud_autosave_browser.py` (Playwright + Chromium required). See [release status](RELEASE-STATUS.md) and [GitHub issues](https://github.com/kevincaron28/pokeflip-studio/issues).

## Deployment
The existing Vercel project hosts https://pokeflip-studio.vercel.app. Production source can be deployed directly from a chosen GitHub SHA. Installing and authorizing Vercel's GitHub integration is still needed for automatic push-to-deploy. Preview protection is enabled, production frontend public; inventory requires Supabase account authentication.

## Collaboration
Read [AGENTS.md](AGENTS.md) and the [architecture](docs/ARCHITECTURE.md) first. Use feature branches and PRs with tests, and never commit personal data or service-role keys.

## Scanner — Single Card and Stack Mode (v4.2)

On mobile, go to **Scan → Start camera** and choose the capture mode:

- **Single Card — tap capture:** Keep the rear camera running and tap **Capture this card** for each card. Good for individual cards, slow inspection, and similar-looking cards.
- **Stack Mode — automatic:** Fix the camera over a stable card guide, add a card, let it settle, then place the next card **directly on top**. You do not need to remove the earlier cards. PokéFlip captures a new frame after a sufficiently large, stable visual change. Set the target count to 20, 50, or 0 for unlimited captures. Use **Capture missed card** when two cards look nearly identical.

Each frame goes to the existing review queue. Captured count is **photos**, not verified card identities or saved inventory. Review exact expansion/collector number, language, foil variant, and condition before saving or valuing. Auto-capture and OCR are not a benchmarked guarantee of accuracy. A matte backdrop, fixed camera, and diffuse glare-free lighting help; the stack gets taller, so maintain focus. The camera is released when you stop, leave Scan, hide the tab, or close the app. Queue photos are temporary until reviewed—keep the page open or finish saving before closing.

## Android app (Capacitor)
`mobile/` wraps this web app as an Android app (offline assets, native camera permission, local notifications, `top.kcaron.cardstudio://auth` sign-in return). The website stays the web backup. See [docs/ANDROID.md](docs/ANDROID.md) for build, CI, signing secrets and Supabase redirect URLs, and [docs/PLAY-STORE-READINESS.md](docs/PLAY-STORE-READINESS.md) for Play Store prerequisites (including a name/trademark risk). Not yet verified on a device.
