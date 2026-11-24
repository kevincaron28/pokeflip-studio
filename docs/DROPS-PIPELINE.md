# Drops pipeline: the server shop checker

Status 24 Nov 2026. Feeds `public.drop_events`, which the Discord bot (`docs/DISCORD-DROPS.md`) and, later, phone push read.

## What it does
`supabase/functions/shop-checker` runs every 2 minutes (Supabase Cron). Each run reads the shops that are due, so every shop is read about every 4 to 5 minutes, with the app closed.

| Step | Rule |
|---|---|
| Sources | The public storefront data of 89 Canadian card shops on Shopify (`canada-shops.js`) plus Indigo and Mastermind Toys (also Shopify): `/products.json?limit=250` (newest 250 products). Robots and terms checked when each shop was added; no bot wall. |
| Politeness | `User-Agent: Cardstead-stock-check/1.0 (+https://pokeflip-studio.vercel.app/privacy.html)`, one request per shop per pass, `If-None-Match` with the shop's ETag (an unchanged catalogue answers `304` with no body), at most 6 shops at a time, 10-second timeout. A shop that answers 403 or 429 is left alone for 30 min, then 1 h, 2 h, 6 h. |
| Matching | Same rules as the app's restock matcher (#45): one known set, one product size, one language. Cases, "bundle of 24", single promo cards, accessories and era-only names ("Scarlet & Violet … Collection") are skipped. Collections, tins and blisters keep their own product key (`30th-celebration|collection:ditto|EN`). |
| Price sanity | Under 40% or over 3× the TCGplayer market value of that set and size: another product sold under the set's name, skipped. |
| Change only | A product becomes a drop event only when it goes from sold out (or unseen) to in stock, or back. The first read of a shop records what is there without alerting. |
| Confirmation | An in-stock change is re-read on the product's own page (`/products/<handle>.js`); only if that also says available is it written. Otherwise the old state is kept and the next pass looks again. |
| Event | `drop_events` row: `source=shop_check`, `confidence=medium` (title match; never high), `matched_by=title`, UPC from the shop's SKU when it is one, price, TCGplayer market value in CAD, region from the shop's city, `event_key` per store, product, state and hour (inserting twice does nothing). |
| Speed log | `first_seen_at` = when the checker confirmed it; `source_updated_at` = the shop's own update time for that product. The difference is the detection lag. |

Measured on 24 Nov 2026 against the newest products of 15 of these shops (saved copy, no live alerts): 176 in-stock sealed products recognised. The rejects were cases, multi-packs, accessories, a promo card, era-only collections, and premium products priced 3× over the set's pack or ETB.

## Owner steps
1. Supabase → SQL Editor → run `migrations/003-shop-checker.sql` (after `002-discord-drops.sql`).
2. Deploy: `supabase functions deploy shop-checker --project-ref fehvorwdcswhhonavyit`.
3. Supabase → Integrations → Cron → Create job: name `shop-checker-tick`, schedule `*/2 * * * *`, type Supabase Edge Function, function `shop-checker`, method POST, body `{"task":"tick"}`, with the secret key header (same preset as `discord-drops-tick`).

**Refusals (429) from Supabase.** On the first passes, 42 of 45 shops refused Supabase's shared outbound address while answering normally from a home connection. To measure it: call the function with `{"task":"probe","offset":0,"limit":12,"gapMs":4000}` (then offset 12, 24, ...): one small request per shop, one at a time, nothing saved; the reply gives each shop's status and the egress address. Pacing can be set with the secrets `CHECKER_CONCURRENCY`, `CHECKER_GAP_MS`, `CHECKER_MAX_SHOPS` (a run must end within 150 seconds). If refusals stay, run the checker on the Oracle VM instead: [SHOP-CHECKER-VM.md](SHOP-CHECKER-VM.md).
4. Optional: set `CARDSTEAD_URL` if the site moves (the checker reads `data/drop-catalogue.json` from it).

Cost: free tier. About 22,000 function calls a month (one every 2 minutes) and about 1.3 million small shop requests a month spread over 91 shops (one every 4–5 minutes each), mostly answered `304 Not Modified`.

## Inputs, rebuilt daily
`node tools/build-drop-sources.mjs` (run by the daily refresh workflow) writes `supabase/functions/_shared/drop-shops.json` (the shop list) and `data/drop-catalogue.json` (sets, sealed products, market value in CAD). A new shop in `canada-shops.js` reaches the checker after the next deploy.

## Not in this piece
Retailer back-in-stock emails (Cloudflare Email Routing, waiting for the owner's sign-in), the Amazon Creators API (waiting for Associates approval), member reports (in the Discord bot), phone push (reads the same table, next piece).
