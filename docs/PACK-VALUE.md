# Pack value tab (booster pack EV)

For each set's single English booster pack, the **Pack value** tab shows:

| Column | Source | Notes |
|---|---|---|
| MSRP | `pack-ev-rates.js` → `msrp` | US$4.49 per pack for numbered main sets (SV01–SV10, ME01–ME06), cited (Kotaku, 25 Mar 2026; SNKRDUNK, 29 May 2025). **No official Canadian MSRP was found**, so CAD shows "unknown". Special sets (151, Paldean Fates, Prismatic Evolutions, Ascended Heroes, …) show unknown: no source confirms single-pack retail. |
| Sealed pack | `pack-ev-data.js` | TCGplayer market price of the "<Set> Booster Pack" product. |
| EV opened | `pack-ev.js` | Σ expected copies per pack × average market price of that rarity. |
| EV − sealed | | Positive: worth opening on average. Also shown as "EV = N% of sealed". |
| Verdict | | **Worth opening** (EV ≥ sealed), **Keep sealed** (sealed > EV), **Skip at retail** (both below MSRP), **Not enough data**. |

Prices are USD; CAD uses the Bank of Canada daily USD/CAD rate stored with the snapshot. Every price has its "as of" date on the page.

## EV method

- **Hit odds**: TCGplayer Infinite "Pull Rates" articles (pack studies of 1,200–8,500 packs each). The exact percentage per pack is used, not the rounded "1 in N" (TCGplayer calls those much less precise). Each table keeps the line exactly as printed, its sample size and its URL. Delta Reign uses an early 252-pack community sample and is marked **low confidence**.
- **Pack layout**: Bulbapedia, *Booster pack (TCG)*, international Scarlet & Violet layout: 4 commons, 3 uncommons, two reverse-holo slots (the first can be an ACE SPEC or Shiny, the second an IR/SIR/Hyper Rare), one rare slot (Rare / Double Rare / Ultra Rare). TCGplayer's slot notes match it for every SV and ME set used.
- **Bulk**: commons and uncommons at their average Normal market price; reverse holos at the average Reverse Holofoil price of commons to rares, minus the hits that take a reverse slot; plain Rare = rest of the rare slot.
- **Card prices**: TCGplayer market price (Near Mint, English). Pattern prints (Poké Ball, Master Ball, Energy Symbol, …) are their own pools.
- **Assumption**: every card of a rarity is equally likely (TCGplayer's articles make the same assumption).
- **Unknown, never guessed**: Shrouded Fable (no published table); Sword & Shield sets (TCGplayer's odds are by card type — V, VMAX, alt art, gallery — while its price list lumps them in one rarity, so averaging would overstate EV); a rarity with "Unknown" odds (Black White Rare) makes that EV a lower bound; 30th Celebration (5-card packs, one unmapped rarity) is a lower bound.

Cross-check on 23 Nov 2026: Journey Together EV US$3.11 vs sealed US$6.19 here; PokemonPriceTracker showed EV US$3.10 vs market US$6.21 the same day.

## Refreshing prices

```
node tools/build-pack-ev.mjs
```

Downloads the TCGplayer catalog and prices for every released SV, ME and SWSH set from tcgcsv.com (named User-Agent, one request per file, as its usage guidelines ask) and the Bank of Canada rate, then rewrites `pack-ev-data.js`. The app never calls tcgcsv.com itself. Commit the regenerated file; the "as of" dates update with it. New sets appear automatically; add their pull-rate table to `pack-ev-rates.js` once TCGplayer publishes one (the tests require a source URL and the odds as printed).
