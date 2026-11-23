# Canadian stock alerts — what is automatic, what is manual

Status 2026-11-23. Implemented in `canada-retailers.js` and `restock-watch.js`; tests in `tests/canada-retailers.test.cjs` and `tests/restock-auto-browser.py`. Nothing here has been run on a phone yet. The Discord alert servers the owner joined were **not read** for this work (needs the owner's Chrome and the master session's go-ahead), so alert-format/timing ideas from them are not included.

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
| Tistaminis, Doe's Cards, Rain City Games (independent **Shopify** shops) | **Automatic while the app is open** | Paste a product URL on the watch; the app reads the shop's public `/products/<handle>.js` and records in stock / sold out + CAD price |
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
