# Simplify Cardstead (November 2026)

The owner's feedback, verbatim: "navigation is not very good. There are way too many options, not a lot of things detect automatically and a lot of things require manual input … We need graphs for prices and make it easy to look at for quick information and decision taking. We might have overcomplicated things with too many useless features or options."

What a beginner collector in Québec needs at a glance:
1. **Is this a good buy right now?** Price vs MSRP vs market value.
2. **Where is it in stock?**
3. **How has its price moved?** A price history graph.

## 1. Audit (23 Nov 2026, `main` at ae5368e)

Walked at 390 px and 1440 px. Before screenshots: `simplify-shots/before-*.png` in the session notes.

**Today: 12 tabs, about 140 inputs, 39 headings.** The Restock tab alone is about 11,450 px tall at phone width (≈ 14 screens), with 26 inputs and a 186-store list on screen. The home screen ("Your resale business") is a profit dashboard for selling lots, not an answer to "what should I buy or watch".

Legend: **K** keep (main tabs), **M** merge, **A** move behind "Advanced", **R** remove.

| Tab (inputs) | What it holds | Decision | Why |
|---|---|---|---|
| Dashboard (0) | Resale profit, lot recovery, sorting priorities, getting started | **M** → Collection | A seller's dashboard. The new Home answers "buy / watch now" instead. |
| Scanner (39) | Camera, OCR, symbol match, grading pre-check, bulk count | **K** in Collection | The main way to add cards. Hide manual FX (USD/EUR → CAD) and the grading pre-check under Advanced in phase 2. |
| Buy or Pass (8) | Lot deal calculator | **A** | Eight manual numbers, used rarely. The pack and product verdicts answer the common case. |
| Purchase lots (5) | Lot ledger | **M** → Collection | Needed for resale accounting, not for buying. |
| Inventory (3) | Card list | **K** in Collection | |
| Sales (7) | Sales ledger | **M** → Collection | |
| eBay prices (18) | Manual sold-comp entry, fee calculator | **A** | Eighteen manual fields. Market history now comes from the snapshot and graphs. Kept for sellers. |
| Sealed & sets (17) | Manual store / sold observations, landed-cost calculator | **A** | Its job (is this price fair?) is now automatic in product views (verdict + compare stores). |
| Pack value (5) | Booster pack EV list and detail | **K** → Prices | One chip in Prices, now with the price graph in its detail. |
| eBay deals (9) | eBay watchlist and deals | **M** → Watch | Deals are things to watch. |
| Restock watch (26) | Area & stores, sources, Ready to buy, follow region, retailer one-tap list, add watch, record check, alerts inbox, observations | **K/A** → Watch | Keep: Ready to buy, my watches, add a watch (simplified). **A**: sources, follow-region checkboxes, retailer one-tap list, manual check form, alert import form, raw observation log. Area & stores moves to Settings. |
| Settings & backup (5) | Backup, sorting guide, cloud sync, limitations, checkout tips | **K** → Settings | Settings gets My area & stores, Language and **Advanced**. |

**Manual input that can be detected or defaulted:**

| Today | Instead |
|---|---|
| Typing an exact product name to watch | Search the catalog (2,700+ TCGplayer sealed products and cards in the snapshot) or open a product and tap **Watch**. |
| Picking Format (pack, box, ETB…) | Detected from the product. |
| Typing "Max price you would pay" | Defaults to today's market value (rounded down), editable. |
| Typing "Retailer / area" | From My area & stores. |
| Province, region, stores | Already defaulted: Québec, every Québec shop, every online shop, every chain. The city is still never guessed. |
| Language | From the browser (fr → French), with a switch in Settings. |
| Set and pack in Pack value, Compare stores, alerts | Already detected from the product name. |
| eBay alert threshold | Default 10% under value (exists). |
| Alerts on a new watch | On by default: back in stock at or under the max price (exists once a watch is saved). |
| USD/EUR → CAD (Scanner) | Bank of Canada rate from the snapshot (phase 2). |
| Card language / condition defaults (Scanner) | Remember the last choice (phase 2). |

## 2. Research (what similar apps do)

Store listings, websites and reviews only: tab counts and in-app charts were mostly not verifiable. Full notes are in the session scratchpad report.

- **No app combines "price vs MSRP vs market", "where it's in stock" and a chart.** Price apps (Collectr, Dex, TCGplayer, PokeData) show value only. Stock apps (HotStock, CCN, PokeRestock) show availability only. That combination is Cardstead's niche.
- **Price apps**:
  - Collectr and Dex are praised for smooth navigation and fast scanning.
  - TCGplayer users are confused by four price labels (Mid, Low, Direct Low, Market).
  - PokeData's sealed grid shows one unlabelled price and no MSRP.
  - Card Ladder is criticised for a "massive list of destinations" and for having no onboarding.
- **Stock apps**:
  - HotStock: pick a product, tap "ALERT ME". Reviews say alerts often arrive too late.
  - PokeRestock: per-category toggles at onboarding. Reviews complain of duplicate and resale-priced alerts.
- **Charts**: where they exist, they use one market line with range chips (1M/3M/12M style). The recommendation is to say plainly how many days of data exist rather than draw a fake line.

## 3. The plan

### Five tabs
1. **Home**: "What should I buy or watch now?"
2. **Prices**: search any sealed product or watched card, with short words and aliases ("surging etb", "bb"). Before typing it lists the booster packs and ETBs of the newest sets. The full booster pack list (Pack value) is one chip away. Every result opens a **product view**.
3. **Watch**: my watches, Ready to buy, alerts, eBay deals. The advanced restock tools sit in one collapsed section.
4. **Collection**: scanner, inventory, purchase lots, sales, the resale dashboard.
5. **Settings**: My area & stores, language, backup and cloud, and **Advanced** (Buy or Pass, eBay sold research, Sealed price log, checkout tips).

A small row of chips under the tab title moves between the pages of a tab. The phone dock shows the same five.

### Home (real data only)
1. **Good buys right now**: watched products with a recent in-stock store price at or under market value, best discount first. Each shows the price, store, verdict and a 30-day sparkline.
2. **My watchlist at a glance**: each watched product's best recorded price, stock status, verdict and 30-day market trend.
3. **Market movers**: the booster packs and Elite Trainer Boxes whose market price moved most in 30 days, from the real history.
4. **Best eBay deals**: the top three from the last scan, if any.
5. **Quick actions**: Scan a card, Find a product.

Every empty block says what to do ("Watch a product to see it here"), never a fake number.

### Price graphs
- **On**: the product view (sealed products and booster packs), the Pack value detail and watched cards.
- **Ranges**: 7d / 30d / 1y.
- **Lines**: TCGplayer market price in CAD, with each day converted at that day's Bank of Canada rate, and a dashed **MSRP line**. The MSRP line is the cited US MSRP converted, clearly labelled, because no Canadian MSRP is published. Recorded store prices for that product appear as dots.
- **Source**: tcgcsv.com daily archives of TCGplayer prices, every day for 35 days and then weekly back one year, built by `tools/build-price-history.py` into `price-history.js`.
- **Not enough data**: a plain "Not enough history yet (N days)".

### Removed or hidden, with reasons
| What | Now | Reason |
|---|---|---|
| 12-tab bar | 5 tabs | The owner could not find things. Research says long menus overwhelm beginners. |
| Resale dashboard as home | Collection → Dashboard | It answers "how is my business doing", not "what should I buy". |
| Buy or Pass, eBay sold research, Sealed price log | Settings → Advanced | Many manual fields. The product verdict and graphs answer the common question automatically. |
| Restock: sources list, follow-region checkboxes, 30-retailer one-tap list, record-a-check form, alert import, observation log | Watch → Advanced (collapsed) | Power tools. Store choice already lives in My area & stores, and products are watched from a product view. |
| My area & stores in Restock | Settings | A one-time setting, already defaulted. |
| "Add a product watch" form (8 fields) | **Watch** button in the product view; a short form in Watch | Product, format and set are detected, the max price defaults to market value, and the area comes from Settings. |

Nothing is deleted: all data, watches, alerts, the eBay watchlist, Drop Assist and settings keep working. Stored data keeps its format, so no migration is needed beyond reading it.

### Phases
- **Phase 1 (this PR)**: five tabs and chips, the new Home, the product view with graph and Watch button, Prices search, graphs on Pack value, the Advanced sections, auto defaults for new watches, EN/FR for all new screens.
- **Phase 2**: Scanner defaults (remember the last language and condition, Bank of Canada FX), a shorter Collection dashboard, French for the remaining older screens, and a scheduled refresh of the snapshot and history (GitHub Action opening a PR).

## Phase 1b (owner follow-ups, 23 Nov 2026)

### "A nice list of retailers with their stock in the app instead of links"
- **Compare stores is now an in-app list, not a table of links.** Each store shows:
  - a name badge and the store name;
  - where it is: the city for a local shop, "Online", or "Chain · stores and online";
  - where the information came from (your check, automatic shop check, imported alert);
  - in stock / sold out / unknown, and when it was last checked;
  - the **purchase limit** when known (from the watch's "Shop limit per customer");
  - the price with its own verdict.

  The Buy / Open link is a **small secondary button**. Followed stores with no record are listed as "Not tracked · No check yet" with a small Search button.
- **Watch rows** get a **Stores** button that opens that list for the product.
- **"Check Canadian retailers now"** (Advanced) shows, for the selected watch, each store's last recorded stock, price and time, or "No check recorded for this product yet". "Check now" stays a secondary link.
- Store logos are not shown: using retailers' logos needs their permission. A two-letter badge stands in.

### "Easy option to remove the most recent picture when scanning cards"
Research (store listings, help centres; several apps' flows could not be verified):
- CardCastle has a one-tap **Undo** that removes the last scan and is lit only when there is one.
- ManaBox keeps a running scanned-cards list.
- TCGplayer remembers condition, printing and language for the batch, and lets you review the queue before confirming.
- Dex+ shows an overview after scanning.
- Ludex saves nothing until "Add to Collection".

Adopted in the scanner's new **scan tray**:
1. **Undo last photo**: one tap, always in the same place, enabled only when there is a photo.
2. **Recent photos strip**: the last 8 captures with now / next / done labels and a **×** on each, to remove any one. The scanner moves to the right photo.
3. **Saved this scan session**: a review list of every card saved since opening the scanner, with **Edit** (the usual editor) and **×** to remove a mistake. It refuses if a sale is recorded. **Undo last saved card** sits next to Undo last photo.
4. **Remembered defaults**: card language, condition and finish stay as you last set them.

Already in Cardstead and kept: continuous **Stack mode** (camera stays open), the match list to confirm or adjust the printing, quantity, and condition.

Next (phase 2): merge consecutive scans of the same card into a quantity, and a "set lock" to narrow matches to one set.

## Phase 2a (done)
- **Scanner**:
  - The "Market references" panel is **removed**: its manual USD→CAD / EUR→CAD fields were never read by any code, and its quote box never filled.
  - The real marketplace quotes (TCGplayer USD, Cardmarket EUR) now show their **CAD equivalent at the Bank of Canada rate** stored with the price snapshot (USD and EUR, dated).
  - Card language, condition and finish are remembered (phase 1b).
- **Business page** (Collection → Business):
  - The headline numbers and **Today's priorities** stay on top. Value over time, pricing confidence, sorting plan, highest-value cards and lot recovery move under **More business details**.
  - The duplicate "Getting started" panel is **removed**: "Start here" covers it and hides once a lot exists.
  - About 3,470 px → 1,440 px at phone width.
- **Settings**: the sorting guide, "Current limitations" and "Fast checkout tips" fold into one **Help & tips** section.
- **Watch form**:
  - **Product and max price** are the only fields shown. Format, language, area, quantity, shop limit and Shopify link sit under **More options**.
  - Format is **detected from the product name** when left on "Any".
  - The area **defaults from My area & stores**.
  - Product names are **suggested from the catalog** as you type.
- **Weekly price refresh**: `.github/workflows/refresh-prices.yml` rebuilds `pack-ev-data.js` and `price-history.js` every Monday and opens a pull request. It never pushes to `main`. It needs the repository setting "Allow GitHub Actions to create and approve pull requests". Close and reopen its pull request to run CI.

## Phase 2b
English and French ("tu") on every older screen.
