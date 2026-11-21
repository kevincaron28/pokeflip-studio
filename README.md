# PokéFlip Studio v2.7 — Consolidated Release Candidate (2026-11-21)

**Status: local-first release candidate, NOT yet a verified production launch.** This build includes inventory, bulk lots, OCR-assisted card identification, manual variant review, grading screening, eBay sold-comparable ledger, sealed-product reference guide, Québec restock watch, unified imported alert inbox, and optional cloud-sync UI. There is no automatic live sold-sales data feed and no always-on retailer monitoring. Camera image recognition has not yet passed testing on real French/English card photos.

## v2.7 completed work

- Added `cloud-sync.js` for optional email OTP sign-in, manual encrypted-in-transit uploads/downloads to a **dedicated** Supabase project. Uses revision checks to prevent blind overwrites across devices; synchronization is **manual**. Do **not** use an unrelated project. Run the reviewed `cloud-schema.sql` in the dedicated project's SQL editor, enable email auth, and configure an OTP mail template. Obtain only its public project URL and **publishable** key. Never enter a secret/service-role key. For users with existing cloud data, download before uploading.
- Added the previously missing **imported alert inbox** (`alertHub`) to the full JSON backup/restore format, with schema validation.
- Replaced the stale service worker precache list. Static application code and icons now cache under `pokeflip-shell-v2.7`; alerts and cloud client code are included. Unrecognized paths, external APIs, authentication and inventory responses are **not** cached by the service worker.
- Hardened load/restore validation and added cloud-config unit tests. All 43 local tests passed in the final test run (verify again before deploying).

## Host, configure and test

1. Upload the entire `pokeflip-mvp` directory to an HTTPS static host. No secret credentials should appear in deployment files.
2. On an empty browser, create one $1 purchase lot, enter FR bulk inventory, record and undo a sale, export the full JSON backup, then restore it. Verify that alerts, sealed comparisons, eBay comparisons and watchlists return correctly.
3. For optional cloud: create a **new dedicated** Supabase project, apply `cloud-schema.sql`, ensure the RLS policies are enabled and database advisors report no issues, then enter project URL and publishable key in Settings. Verify email OTP and cross-device conflict handling before relying on sync.
4. On an actual Pixel device: take front/back pictures of multiple FR and EN cards, including visually identical art from different sets, reverse-holo printings and old set symbols. Check both false positives and time-per-card. Never auto-price uncertain matches.
5. To test locally: `node --test tests/*.test.cjs` and `for f in *.js; do node --check "$f"; done`.

## Known blockers for a production claim

- A **dedicated** cloud database does not yet exist; `cloud-schema.sql` has not been applied or security-audited in a live project. Cloud functionality is implemented but not live-verified.
- Chromium attempts to open both localhost and file URLs were blocked by the test environment, so no end-to-end browser or phone camera pass is claimed.
- OCR and symbol shape matching have not been benchmarked against a labeled real-photo validation set. Finish and card condition remain user-confirmed.
- Live eBay Product Research history requires authorized access; supported manual sold-comparable workflow is not a live sold-listings API.
- Automatic overnight retailer checks / push alerts need an authorized data feed and continuously operating service; the current app imports third-party alert notices while open.
- Accounting still excludes some refunds, taxes, ad charges, and advanced reconciliation.

---

# PokéFlip Studio v2.5 — Restock Watch (local build)

**New:** A regional Québec/Montérégie + Canada-wide restock watch tab. The new feature stores exact product/edition watch rules, a maximum CAD purchase price, language, local retailer directory, Canadian retailer and restock service links, and a manually verified stock observation log. On-page browser alerts can trigger for an observed transition into stock below your ceiling *while the app is open*. The browser does not poll retailers, monitor in the background, independently verify availability, or promise push alerts while closed. For real-time alerts connect an external specialist provider through its site.

**Backups:** JSON exports/imports now include `restockWatch`, validated before restore. Any earlier JSON backup without this field imports an empty watchlist. Do not rely on browser storage alone as a secure cloud backup.

**Privacy and compliance:** We do not scrape protected retailer endpoints, impersonate an authorized reseller, or claim regional inventory from a product's nationwide availability. Linked local shops are leads to investigate and contact—not verified inventory sources. Prices are in Canadian dollars.

---

# PokéFlip Studio 1.3 — Local release candidate

A local-first Pokémon card resale ledger for beginners. French and English cards, inventory lots, sortable card entries, cost-of-goods and net sales in **CAD**. Starts with an empty inventory.

**Release classification:** **installable single-device release candidate, not production cloud software**. The app is fully usable without a paid service for manual inventory and sale recording, but the card scanner is OCR-assisted, not a validated high-throughput card-identification engine. Do not treat values as live verified market prices.

## Quick start

1. Run `python -m http.server 8000` from this folder, then open `http://localhost:8000`; or deploy the *entire folder* to an HTTPS static host such as Vercel, Cloudflare Pages or Netlify. Do **not** upload JSON backups.
2. On Android, open the **hosted HTTPS URL** in Chrome and use **Add to Home screen / Install**. HTTPS is required for installation and service-worker caching.
3. Create a purchase lot, add individual card photos to the queue (one card per picture), verify results, confirm category and storage box, and save. Cards with uncertain matches should be kept in the **R** review box.
4. Count cheap bulk by language to skip slow individual scanning when a card is unlikely to be valuable. You can still choose to scan every card.
5. Use the *Inventory* edit action to fix quantity, price, cost, condition and location. Duplicate cards with the same characteristics in the same lot automatically consolidate.
6. Record sales **including all marketplace fees and seller-paid shipping/packaging**. Realized profit will require allocating purchase costs, and may not account for taxes or your time.
7. Before buying a collection, open **Buy or Pass** to calculate a conservative acquisition scenario (asking price, likely sell-through, selling fees, fulfillment, and target profit). Scenarios never change your business records.
8. Download a JSON backup after each serious sorting session. The software reminds you when there is no recent backup. To restore, use **Guide & backup → Restore JSON backup**.

## Data handling

- All inventory, sales and seller names are stored in the **device/browser localStorage only**. They are not uploaded by the app. Clearing site data can permanently erase them. Browsers impose storage quotas. The app warns if saving fails.
- Photos are shown temporarily for the scan session; they are **not saved** and are not in a backup. OCR runs in-browser using Tesseract.js, which fetches its code and language models from external services. Search queries access **TCGdex**. The PWA shell can load offline, but card search and first-time OCR cannot.
- JSON backups contain your business data and are unencrypted. Store them securely and do not publish them on GitHub or the web server.
- A backup restore validates row IDs, foreign keys, quantities, and monetary values; invalid data is rejected before replacement.
- Saving records after a second tab has modified them can cause conflicts, so another tab makes the current tab read-only until reloaded.

## Accounting caveats

- Lot cash recovery = proceeds net of selling expenses **minus the entire amount paid for that lot**. This is *not* the same as income recognized from sold cards.
- Sold-card profit uses cost per card. When acquisition costs have not yet been allocated, the UI marks profit as incomplete. Recorded cost basis is snapshotted at sale-time when known.
- Inventory resale prices are **manual estimates** in CAD, not authenticated comparable sales. French vs English, condition, reverse holo, first edition and stamped promos can all materially change the price.
- Tax, returns/refunds, advertising, inventory write-offs, postage tax treatment and labour are **not yet fully supported**. Consult an accountant before using exported figures in tax filings.

## Local checks

Run:

```bash
node --check app.js
node --test tests/smoke.test.cjs
```

The automated tests check startup, creating a purchase lot, recording bulk and sales, cost behavior, and malformed backup rejection. **Manual browser/Android camera testing is required** for full acceptance. The execution environment currently blocks a Chromium browser session; tests are not claimed to cover every UI flow.

## Not production-ready until

- Cloud-hosted authentication and **row-isolated server-side storage** with synchronized backups, conflict detection and recovery
- Permissions and a privacy/security review of the hosted service
- Verified optical card identification with confidence and variant checks, on actual Pixel/Android camera photos, including French and English cards
- Authorized price feeds / comparable sales with language and condition matching, and legally accurate price refresh
- Manual Android acceptance run (camera permission, OCR, 200-photo batch, airplane mode, PWA update, backup restore, real sale and undo)
- Support for refunds, tax reporting and reconciled expenses if this becomes a commercial business tool

## Technical notes

`index.html` contains the interface; `app.js` is the application. `sw.js` caches the shell and performs network-first refresh on same-origin requests; `manifest.webmanifest` and PNG icons support installation. `vercel.json` applies basic security headers. External card images and remote API requests require an online connection. The service worker does not cache photos or private inventory.

An independent project; not affiliated with or endorsed by The Pokémon Company. Card metadata: [TCGdex](https://tcgdex.dev/). OCR: [Tesseract.js](https://tesseract.projectnaptha.com/).

## Portfolio dashboard (v1.3)

- Estimated unsold value includes only inventory entries with manually entered CAD prices. Unpriced cards are displayed separately rather than assumed to be worth $0.
- Historical line chart records local snapshots of entered estimated value. Changes due to purchases are **not** market gains, and the chart is not a return-on-investment chart.
- Price coverage, sorting priority queue, language mix, most valuable items, lot recovery and cost-basis gaps help guide work sessions.
- v1.2 JSON backups include price-history observations. Older schema-2 backups remain importable.
- Portfolio pricing is not live; no Collectr, TCGplayer, Cardmarket, eBay or PriceCharting feeds are connected. Data access/licensing must be confirmed before integration.

## 1.3 changes (November 21, 2026)

- **Buy or Pass** scenario calculator uses sale-through assumptions, variable marketplace fees, order fulfillment and fixed expenses to show forecast net profit, a hypothetical maximum bid and break-even resale values. These are estimates, not live prices or guarantees.
- Hardened CSV exports against common spreadsheet formula injection patterns in user-entered text.
- Backup restore now validates portfolio-history data before replacing any saved data, and writes the restored ledger before changing the current in-memory view.
- Seven Node.js tests cover the original business flow plus calculator profit, zero-sales, and invalid input conditions.
- Offline shell version bumped to v1.3. No backend or user authentication has been added.

**Release decision:** not ready for a public multi-device commercial release. The hosted app would still use local browser storage, and camera OCR plus live market quotes have not passed acceptance tests.

## v1.4 symbol-reference matcher (beta)

- **Set symbol matching:** The Scan & Sort tab accepts a tightly cropped photo of the expansion icon and compares its shape to TCGdex set-symbol references using a lightweight on-device bitmap similarity algorithm. No neural model is trained, no user photograph is uploaded to PokéFlip, and there are no per-scan model inference charges. The browser downloads reference images from TCGdex; that catalog access needs Internet and compatible cross-origin image headers.
- **Choose the right set:** Set-name and printed-total filters can reduce bandwidth. To protect phones, a search with more than 180 symbols asks for a narrower filter. The highest ranked symbols are shown with reference images and uncalibrated similarity scores; selecting a set only fills the set filter, and the user must still match the collector number and artwork.
- **Quality limits:** Small, blurry, tilted, reflective or partially obscured symbols can score poorly. Some sets share similar marks. Scores are NOT probabilities of correctness. No automatic set match can be assumed correct and no card is saved or priced by the matcher. Test the workflow with real cards before using it for large inventory.
- **Existing incomplete dependencies:** This release removes missing `market.js` and `cloud.js` script tags found in the development HTML. Remote pricing and cloud sync are not implemented. Do not consider this a production commercial release.
- **Tests:** `node --test tests/*.test.cjs` checks the core app and synthetic symbol similarity cases. End-to-end TCGdex image loading and camera correctness were not verified here.


## Scanner accuracy and grading screen (v2.1)

* A selected set hint now **strictly filters** candidate cards to that set rather than merely reordering unrelated series. If no matching card exists, the scanner shows no matches.
* After selection, the full TCGdex card record is used to disable foil variants explicitly marked unavailable. Unknown and special finishes still need visual inspection; TCGdex variant metadata is not exhaustive.
* The grading-potential screen accepts separate front/back photographs. Image resolution, gross glare, and gross contrast/sharpness are checked locally and never transmitted to a grading service. The collector checks centering, corners, edges, and surface. Only after both usable photos and all four defect checks can a card be marked **Potential grading candidate**.
* This is a screening aid, **not** visual AI grading, a PSA/BGS/CGC score, guaranteed grade, or market valuation. Smooth images can conceal dents, holo scratches, whitening, or fake cards. Photo-quality screening cannot see defects. Use raking light, a loupe, and professional examination before paying to grade.
* The screen result is saved with the inventory item (without photo bytes) and appears in inventory. Changed inputs invalidate an earlier assessment. Keep manually evaluated cards separate from unassessed duplicates.



## v2.3 — eBay sold-comparable research (November 21, 2026)

The new **eBay Prices** tab lets you open eBay.ca sold-item search and eBay Product Research, then save manually verified sales next to a specific inventory card. This deliberately **does not scrape eBay** or claim an eBay sold API integration: public Browse results are active listings, while Marketplace Insights sold history is restricted.

- Save sale date, currency (CAD/USD), sale amount, buyer shipping charge, language, card finish, condition and optional eBay evidence URL.
- Match comparisons to the **same inventory card** (therefore the same identified set/collector number), language, finish and condition. CAD and USD observations are never mixed.
- Show a 90-day, CAD-only median and require **three or more matching sold observations** before allowing an explicit user-approved estimated inventory price update. The applied value is **item-only median** and excludes buyer-paid shipping, with source/date metadata.
- Use a configurable eBay.ca fee estimate (example 13.25% plus $0.30/$0.40 order charge), with shipping, collected sales tax, packaging and optional promoted-listing inputs. Verify actual eBay seller charges in Seller Hub.
- Save the observed eBay comparisons under `pokeflip-ebay-comps-v1` and include them in JSON backup and restore. Cloud sync of comparable observations is **not implemented**.

**Limitations:** Data is manually entered and not continuously refreshed. A match remains only as strong as its verified printing: confirm the expansion, collector number, language, foil pattern, condition, and whether a sale was a single card or a bundle before recording it. The software does not automatically retrieve actual accepted Best Offer prices; use eBay Product Research for this. Median sold comparison is not an instant-sale guarantee, and three observations are a workflow safeguard rather than statistically sufficient proof of market value.

**Verification:** 20 Node.js unit/smoke tests pass; JavaScript parses cleanly. Full visual browser and mobile-device tests still need to be completed. No production deployment has been confirmed.

## v2.4 — Sealed Products & Set Guide (November 21, 2026)

The **📦 Sealed & sets** tab adds a beginner-friendly way to compare store pricing on booster packs, booster boxes, Elite Trainer Boxes (ETBs), booster bundles, blisters, tins and special collection boxes.

- Loads an expansion catalog from TCGdex `GET /v2/en/sets` when online. TCGdex is a *set/card catalog*, **not** a complete sealed-product SKU and pricing catalog; always confirm the exact product name, edition and pack count on the manufacturer's packaging. The set catalog will not include prices.
- Different product formats, edition/variant (e.g. standard versus Pokémon Center), language and pack count are treated as distinct. Product matching remains user-entered, not a UPC lookup.
- Estimate landed cost in CAD from retail price, store shipping and adjustable taxes (14.975% is the typical combined Québec GST/QST example, not a universal charge). Divide by **verified** contained booster pack count.
- Record store asking-price observations separately from verified completed-sale prices. The app requires **at least three CAD sold prices within 180 days** for exactly the selected product identity before displaying the median resale reference. This threshold is a minimum evidence safeguard, not proof of a fair market value or a liquid market.
- Show conservative before-labour estimated resale margin net of your adjustable selling-fee percentage and flat fulfillment expenses. eBay fees may also apply to shipping, taxes and orders; this simplified scenario is **not** a final settlement calculation.
- Link out to eBay.ca sold search. For actual accepted Best Offer sold prices, use eBay Product Research and verify the listings manually. **No automated eBay sold price feed is connected.** The app neither claims live quotes nor auto-populates prices from other websites.
- Sealed observations are stored separately in local browser storage (`pokeflip-sealed-v1`) and included in full JSON backup/restore. Clearing browser data or switching devices without restoring a backup will lose them.

**Buying caution:** Cost per booster pack does *not* equal the expected monetary value of opening packs. Resale and card-condition outcomes are uncertain. A sealed median price is not an authenticity check, and the store's asking price alone never establishes value.

**Testing:** `node --test tests/*.test.cjs` checks the benchmark's identity matching, date window, insufficient sold data handling, currency restrictions, accounting and backup integration. Real browser and device testing, production auth/cloud sync, and licensed live price feeds are still required for a production release.

**Reference sources:** [TCGdex set catalog](https://tcgdex.dev/rest/sets), [Pokémon official product descriptions](https://support.pokemon.com/hc/en-us/articles/360001024394-What-types-of-Trading-Card-Game-products-are-available), [eBay Canada Product Research](https://www.ebay.ca/help/selling/selling-tools/terapeak-research?id=4853).

## v2.6 Unified Alert Hub (local import)

The Restock Watch tab now includes a source-attributed, consolidated alert inbox. Paste alerts from subscribed sources (Pokénnoisseur, The Drop Watch, Card Restock Tracker, Pokewatch Canada, retailers), review extracted product/price/URL and save. Repeated alerts for the same product/retailer/URL replace older observations rather than generating duplicates. Filter against product watches and maximum CAD prices; export/import alert history as a separate JSON backup (`pokeflip-alerts-backup.json`). All provider statuses are *reported*, not verified live retailer inventory. Do not enter alerts in other currencies as CAD; convert using a verified rate first.

**Important**: This does not run a remote scraper or collect private Discord messages. Discord prohibits self-bots and unauthorized scraping. For true automatic aggregation, obtain explicit provider permission or supported RSS/API/webhook feeds, or import notifications delivered to your own email through an authorized email integration. An always-on scheduled service with rate limiting, consent, deduplication and monitoring remains future work. Alert Hub records stay in this browser's local storage; export them separately from the main backup.


## v2.8 security upgrade (pending live deployment)
- Cloud schema v2 permits SELECT only and requires all writes through an authenticated atomic function; direct INSERT/UPDATE by browser roles is revoked. Do not run cloud-schema.sql against an unrelated database.
- The cloud schema has been checked with static tests, **not** a live database integration test.
- A new dedicated Supabase project requires explicit cost consent before creation despite its quoted $0/month cost.
- Chromium in this environment blocks loopback navigation (`ERR_BLOCKED_BY_ADMINISTRATOR`), so browser acceptance remains unverified here.

## v2.9 — Dedicated cloud database provisioned (November 21, 2026)

- Dedicated `PokéFlip Studio` Supabase project is ACTIVE_HEALTHY in `ca-central-1`, under the user's existing organization. Quoted project creation cost: $0/month.
- Owner-isolated snapshot table, revision-checked atomic RPC, and RLS have been applied in the live database.
- Live privilege check: RLS enabled; one owner SELECT policy; anon cannot INSERT; authenticated cannot UPDATE directly; authenticated can execute the revision-checked save RPC.
- Cloud client defaults to this project's public HTTPS URL and **publishable** key; no secret or service-role credentials are embedded.
- The advisory `authenticated_security_definer_function_executable` is expected for the deliberately exposed, fixed SQL atomic RPC. It is restricted to authenticated users, checks `auth.uid()`, validates payload, and checks revisions. It should nevertheless receive a security review before external/public launch.
- Email OTP/magic-link delivery and redirect settings still require live verification and possibly dashboard configuration. This is NOT verified production authentication yet.
- A production Vercel project was created but full application deployment has NOT been completed. No public application URL has been verified.
- Browser QA cannot run in the present container due to environment blocking localhost navigation (`ERR_BLOCKED_BY_ADMINISTRATOR`). All 45 Node automated checks pass.
- eBay market prices and automatic restock monitoring do not yet have compliant live data feeds; manual comparisons and external provider links remain available.

### Initial account workflow
1. Host the entire application folder on HTTPS (don't open `index.html` as a `file://` document for a live account session).
2. In the app's Settings tab, use email sign-in. Depending on the Supabase project's email template, enter the code or open the emailed sign-in link on the SAME browser/device. A code template may need to be configured in Supabase Auth.
3. Verify sign-in, create a small example lot, click **Upload local data**, then verify that a second device can **Download cloud data**. Cloud sync remains explicit, not continuous.
4. Keep downloadable JSON backups, especially while using the release candidate.

## First bulk purchase guide

Read `FIRST-BULK-PURCHASE.md` before buying your first collection. It explains the safest quick-entry workflow and the scanner/pricing limitations.

## Cloud email sign-in update

The app now listens for passwordless sign-in links and displays the current signed-in state, in addition to supporting typed verification codes. Configure the eventual production app URL under Supabase Auth URL Configuration and test login on a real device before treating sync as reliable.


## v3.1 exact-expansion lookup and deploy handoff

- New `card-lookup.js` uses TCGdex direct `/sets/{set}/{localId}` when expansion and collector number are known, eliminating the capped broad-search ambiguity. If a set is known and a name is provided, it searches only the set catalog. Unknown-set results remain suggestions only.
- Chromium embedded UI acceptance test at `tests/browser_embedded.py` passes mobile-width navigation, purchase lots and bulk intake. This does not test network, camera or real localStorage.
- `DEPLOY-WINDOWS.ps1` and `.vercel/project.json` target the existing Vercel project. Read `RELEASE-STATUS.md` for verified release gates.