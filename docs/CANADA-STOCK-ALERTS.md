# Canadian stock alerts — what is automatic, what is manual

Status 2026-11-23. Implemented in `canada-retailers.js`, `canada-shops.js` (generated) and `restock-watch.js`; tests in `tests/canada-retailers.test.cjs`, `tests/restock-auto-browser.py` and `tests/restock-region-browser.py`. Nothing here has been run on a phone yet. The owner's two alert Discords were read (channel names only) by the master session; the retailer and local-shop list is in `docs/research/canada-alert-discords-2026-11-23.md`.

## What existed before
Manual only: you create a watch (product, format, language, ceiling in CAD), then *record* a check you made yourself; a recorded in-stock check at or under your ceiling raises an on-device notification (browser notification via the service worker, or an Android local notification in the app). No polling, no server.

## Why most retailers cannot be polled
No Canadian big-box retailer offers a public stock API. Costco, Walmart, Best Buy, EB Games/GameStop and others restrict automated access in their terms and several use bot management (Akamai / PerimeterX / Cloudflare). A web page also cannot read those sites' pages directly (browser CORS). Cardstead does **not** bypass CAPTCHAs or bot protection, log in, rotate addresses, or scrape. Research found no sanctioned public availability endpoint for bestbuy.ca (third-party scrapers exist; they depend on bypassing protection) and no permission for walmart.ca automation (Walmart's terms are reported to forbid automated collection; its live robots.txt and walmart.ca terms were not verified).

## Per-retailer status

| Retailer | Mode | What you get |
|---|---|---|
| Costco.ca | **Manual** | One-tap search link for the watched product; record your check |
| EB Games / GameStop Canada | **Manual** | Search link; store pickup needs your postal code on the product page |
| Walmart.ca | **Manual** | Search link (check "sold and shipped by Walmart") |
| Best Buy Canada | **Manual** | Search link (ship vs store pickup shown on the page; `/fr-ca/` for French) |
| Toys"R"Us Canada | **Manual** | Google site-search link |
| Amazon.ca | **Manual** | Search link (prefer sold by Amazon.ca) |
| Indigo, London Drugs, Canadian Tire, Real Canadian Superstore/Loblaws | **Manual** | Search links; stock is per store |
| The Source, Shoppers Drug Mart | **Manual** | Google site-search links |
| Pokémon Center (Canada) | **Manual** | Search link; queue/waiting-room drops, no automation |
| Well.ca, Mastermind Toys, Pokémon Center (merch) | **Manual** | Search links (Mastermind: per-store availability by postal code on the page) |
| 74 independent **Shopify** card shops (see "Follow a region") incl. Tistaminis, Doe's Cards, Rain City Games | **Automatic while the app is open** | Paste a product URL on the watch, or follow a region; the app reads the shop's public `/products/<handle>.js` and records in stock / sold out + CAD price |
| Local hobby stores (La carte cachée, Zone Collection, All-In Hobby Sports, Jeux A-Z, Sousa Collects) | **Manual** | Map links; call or visit |

Search-URL templates for big chains were written from their public site structure and are **not live-verified** (the sites block automated fetches). Each retailer carries a `confidence` flag (`unverified`, `fallback` = Google site-search, or `verified-2026-11-23` for the three Shopify shops, which were fetched live: HTTP 200, `access-control-allow-origin: *`, prices in integer cents, `available` per variant).

## The automatic check, precisely
- Only for the allow-listed Shopify hosts in `AUTO_HOSTS`; the watch is rejected if `autoUrl` is any other host. The same hosts are the only extra `connect-src` entries in `vercel.json`.
- Runs only while the app is open and visible; first pass 4 s after load, then every 5 min, but **at most one request per product per 15 min** (`MIN_POLL_MS`), one product at a time with a 2 s gap, 10 s timeout, `credentials: 'omit'`, redirects refused.
- A browser cannot set `User-Agent`, so the request carries the browser's own. (A server version would send `Cardstead-stock-check/1.0`.)
- Failures never invent stock: the status line says why and points to "Check now". Results are recorded as `source: "auto"` observations and use the same qualifying rule and alert as manual checks (in stock **and** at or under your ceiling, only on a new transition).
- Adding a shop = add it to `RETAILERS` with `auto: 'shopify'` **and** to `vercel.json` `connect-src`; a test fails if they disagree. Check the shop's robots.txt and terms first, and that it serves CORS.

## Reaching your phone when the app is closed (not built)
Today an alert appears only when the app is open (local notification in the Android app). True background push needs, in order:
1. **A poller on a server** that checks only allow-listed Shopify shops (modest interval, UA `Cardstead-stock-check/1.0`, contact URL), writing a shared "last status per product URL" table. Options: Supabase scheduled Edge Function (pg_cron) or Vercel Cron (the Hobby plan limits cron to daily; a 15-minute cadence needs Pro or Supabase).
2. **Push delivery:** Firebase Cloud Messaging for the Android app (Firebase project, `google-services.json`, `@capacitor/push-notifications`, device tokens stored per user under RLS) or Web Push for the website (VAPID key pair, a `push` handler in `sw.js`, subscription storage).
3. **Privacy/consent:** the poller would read the product URLs in users' watches, so this needs an opt-in and an update to the privacy policy and Play data-safety form.
Big chains would still be manual: a server cannot legitimately poll them either.

## Owner setup / decisions
- Nothing is required for the current feature; paste a Shopify product URL on a watch to try it.
- To get background alerts: decide on the server poller (Supabase vs Vercel Pro), create a Firebase project, and approve the privacy-policy change.
- Tell us which independent Canadian shops the owner follows; Shopify ones can be added in minutes after a robots/terms/CORS check.
- Optional: an authorized alert-provider feed (see AGENTS.md rule 6: no scraping of third-party Discord services without permission).

## Follow a region (shops found from the Discord list)
`tools/probe-shopify-shops.py` took the ~157 shop channel names from the research file, guessed domains (`slug.ca`, `slug.com`, `www.`, `slug.myshopify.com`, a few TLDs), and kept a shop only if **all** hold: public Shopify `/products.json` over HTTPS; `access-control-allow-origin` present (the browser can read it; nothing is proxied or bypassed); `meta.json` says country CA and currency CAD; `robots.txt` does not block `/products` for `*`; at least one Pokémon product in the newest 250 (probe date 2026-11-23). Result: 88 Shopify stores found, **72 accepted** (+ Tistaminis and Rain City Games added by hand = 74 in `canada-shops.js`). Rejected-but-Shopify: 16 (mostly no Pokémon in the newest 250, one US/UK/NZ-currency store) — listed in `docs/research/shopify-probe-2026-11-23.json`. About 70 shop names did not resolve to a Shopify store with my domain guesses (other platforms like WooCommerce/Wix, different domains, Facebook-only shops): they stay manual. Names and cities are what each shop reports about itself; matching a Discord channel name to a domain is a guess confirmed by the shop's own name, so spot-check before trusting any single entry.

Coverage: Montréal 3, Laval/North Shore 2, South Shore 8, Québec City 1, elsewhere in Québec 1, GTA 30, Ottawa 1, Ontario other 6, Vancouver 7, BC other 2, Calgary 2, Edmonton 3, Alberta other 1, Canada-wide online 7. Québec is thinner than the Discord list (41 shops) because many Québec shops are not on Shopify; unresolved Québec channel names include lacartecachee, zonecollection (the app already links La carte cachée / Zone Collection manually), gamekeeper, jeuxmania, legriffon, multivers, tome2, topdeckhero.

How following works: tick regions in Restock Watch → "Follow a region". While the app is open and visible, for each followed region (max 30 shops per pass) the app downloads each shop's newest 250 products once per **30 minutes** (about 130 KB compressed each; skipped when Data Saver is on) and looks for watched products. A match needs at least two distinctive words from your watch name, all present in the product title. Results are shown as **possible matches** (title, shop, price, available/sold out) with a link; they are never saved as verified stock observations and say to verify exact set, edition and language (AGENTS.md rule 5). An alert fires once when a possible match is available at or under your ceiling and was not available before. Restocks of old products can fall outside the newest 250 and are then missed — use the per-product URL for those.

To refresh the shop list: run the probe (slow by design: ~0.8 s between requests, 3 workers, backs off on HTTP 429 — an earlier faster run was rate-limited by Cloudflare for a few minutes), then `tools/build-shops.py`, which rewrites `canada-shops.js` and the `connect-src` list in `vercel.json`.

## Fast checkout ("Buy now") — what it does and does not do
Decision: Cardstead does **not** store card numbers, tokens or addresses, and does **not** place or submit orders. Retailers' terms forbid bot purchasing and cancel such orders, and handling payment data would bring PCI and Google Play financial-feature obligations. The app instead removes every step before the final confirmation.

- Each watch has a **maximum price (CAD)**, a **quantity** (1–99) and an optional **shop limit per customer**; the cart quantity is `min(quantity, limit)`.
- **Ready to buy** panel (top of Restock Watch) and a **Buy now ×N** button on the watch row appear when the latest check is in stock at or under the maximum (or a regional possible match is available at or under it). Checks older than 2 hours are marked "re-check first".
- Link built per store (`buyUrl` in `canada-retailers.js`): Shopify shops on the allow-list → `https://<shop>/cart/<variantId>:<qty>` (variant = cheapest available variant, read from the same product JSON; opens a cart where Shop Pay / saved details apply); Amazon.ca product link → `/gp/aws/cart/add.html?ASIN.1=<ASIN>&Quantity.1=<qty>` (no affiliate tag; Amazon shows its own add-to-cart confirmation); every other store → the product page you recorded. Nothing is submitted: you confirm payment on the store's page.
- **Android app:** links open in the system browser through `@capacitor/browser` (Chrome Custom Tab), so saved logins, Shop Pay and autofill work. On the website they open in a new tab.
- **Settings → Fast checkout tips** explains where to save payment (Shop Pay, Google Wallet/Chrome autofill, each retailer's account) and to stay signed in.
- Notifications say "Open Cardstead for Buy now". A tap on the system notification opens the app; the link itself is not inside the notification.
- No new data leaves the device (variant ids are read from the shop page already fetched), so `privacy.html` and the Play data-safety answers are unchanged. Payment information is never collected, which keeps the "financial features: none" answer valid.

Not verified: opening links in a Custom Tab on a device, a real Shopify `/cart/<id>:<qty>` landing on checkout for each shop (they are standard Shopify cart permalinks), and Amazon's add-to-cart page behaviour (not live-checked).

## My area & stores (Québec-first, 23 Nov 2026)

The Restock tab opens with **My area & stores**: province, region and city (optional), and a store checklist in four groups:
- local card shops near you;
- online shops that ship across Canada;
- chains and big retailers;
- local shops in other provinces.

- **Default for a new user** (Québec):
  - every Québec local shop, every Canada-wide online shop and every chain;
  - no local shops from other provinces;
  - no region or city, because Cardstead never guesses where you live.
  Region and city sort nearby shops first.
- Everything follows the selection:
  - "Follow a region" polling defaults to every region of your province plus Canada-wide online shops, and skips stores you unticked;
  - polling now rotates least-recently-checked first, so every shop gets its turn past the 30-shop cap;
  - the one-tap retailer list;
  - possible matches in Ready to buy;
  - the alerts inbox, whose default filter is **My stores**.
- Stored on the device only (`cardstead-area-v1`). Users who already chose regions keep their choice.

Coverage after this change: research in `docs/research/quebec-retailers-2026-11-23.md`.
- **39 Québec local shops** in 11 Québec regions:
  - 27 Shopify shops with automatic checks. 12 are new: 5 passed the probe (`tools/quebec-hosts.txt` → `docs/research/shopify-probe-2026-11-23-quebec.json`) and 7 were confirmed by hand because their product titles never say "Pokémon".
  - 12 non-Shopify shops with one-tap Google site searches: Montréal, Verdun, Lachine, Saint-Jean, Québec City, Sherbrooke, Drummondville, and Imaginaire's stores.
- **Online shops**: 15. New: Tonkatom's TCG Station, Hanabi Trading, Shopverse (automatic checks), HappyTCG and Poké-Market (Québec).
- **Chains**: Canada Computers was added (Québec stores, Pokémon boosters category). Toys"R"Us now points at Staples.ca, because toysrus.ca redirects there.
- Gatineau shops moved from Ottawa to **Outaouais (Québec)**, and Côte-Saint-Luc to Montréal.
- **Not added**, because they could not be verified to sell Pokémon TCG or to exist as stores:
  - Giant Tiger, Indigo, Renaud-Bray, Archambault, Jean Coutu, Uniprix, Bureau en Gros;
  - La carte cachée and Fanamanga (no Pokémon evidence online);
  - Vapeland (a vape shop on an unconfirmed host);
  - Magikart (Asian-language product);
  - the Discord handles with no matching store.
- Shipping to Québec is explicit for HappyTCG, Poké-Market and Hanabi. For the other Canada-wide shops it is not checked shop by shop.
