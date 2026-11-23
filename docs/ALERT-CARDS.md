# Alert cards: what is this restock worth?

Every restock or price-drop alert in Cardstead is drawn as one card (`alert-value.js`):

- **Header**: "Restock", "Price drop" or "Stock check", the product, and its TCGplayer image when the product is matched.
- **Store | Price | Status** (green dot for in stock, red for sold out).
- **Price drop line** when the same watch at the same store was seen at a higher price before: `$179.99 → $149.99 CAD (17% off, $30.00 lower)`.
- **MSRP**: CAD is unknown (no official Canadian MSRP was found). The cited US MSRP is shown for main-set products, with its conversion at the Bank of Canada rate clearly labelled. Sources: pack $4.49 (Kotaku 2026), booster box $161.64, booster bundle $26.94, 3-pack blister $13.99, Build & Battle Box $21.99 (SNKRDUNK, 29 May 2025). ETB, tin and collection MSRPs: unknown.
- **Market value (sealed)**: TCGplayer market price of the matched product, with its "as of" date. When TCGplayer lists the same product more than once (for example LGS and retail bundles, or blister art variants), the card shows the range.
- **Expected value of contents** (packs, blisters, bundles, booster boxes, Build & Battle): packs inside × the set's pack EV from the Pack value tab. Pack counts come from Bulbapedia's product list. ETB pack counts vary, so their EV is unknown.
- **Verdict**:
  - green **Under value by $X (Y%)**: price more than 5% under market (the low end of the range);
  - yellow **Fair**: within 5% of market or inside the range;
  - red **Over value by $X (Y%)**, with **scalper price** added at 1.5× the converted US MSRP or more.
  - Without a market match, the verdict compares the price to the converted US MSRP and says so. With neither, it is **Value unknown**.
- **Buy now / Open at store** link and the check's timestamp.

Matching: the set is found by its English name in the alert text, and the product kind by keywords (English and common French wording: *coffret dresseur d'élite*, *boîte de boosters*…), with the watch's format as a hint. The matched TCGplayer product is linked on the card so it can be checked. No match means unknown, never a guess.

Where it appears:
- Restock watch rows (latest check).
- **Ready to buy**.
- The imported alerts inbox.
- Phone and browser notifications, as one line of text with the verdict, MSRP and market value.

Cardstead has no email, Discord or webhook output, so there is nothing else to update.

Data: the sealed product prices live in `pack-ev-data.js`, built by `node tools/build-pack-ev.mjs`. The snapshot loads when the first card needs it.

## Compare stores

Every alert card has a **Compare stores** button. The **Pack value** detail shows the same panel for the set's booster pack, where sleeved packs and 1-pack blisters count as the same product. For that product:

- **Values**: MSRP, sealed market value with its date, the expected value of the packs inside, the best in-stock price and the verdict line, using the same bands as the cards.
- **One row per store** that has a record on this device: your stock checks, automatic shop checks (marked "possible match") and imported alerts.
  - Each row shows the price with its own verdict, in stock or not, when it was last checked, and a Buy / Open link.
  - The latest record per store wins.
- **Order**: in stock first, then cheapest. Unknown prices come after known ones, and sold-out stores come last.
- **Area**: stores from **My area & stores** by default (Québec first). **Show all stores** adds the others.
- **Stores with no data**: followed stores with no record are listed as **Not tracked**, with a search link and never a price.
- **Language**: English or French, with a switch on the panel (French uses "tu"). The first view follows the browser language and the choice is remembered. The rest of the app is still English.
