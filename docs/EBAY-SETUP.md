# eBay deals: one-time setup (owner)

The **eBay deals** tab searches eBay with the official **eBay Browse API** (`item_summary/search`, ebay.ca marketplace, items that deliver to Canada). There is no scraping. The search runs in a small Vercel function (`api/ebay-search.js`) so that the eBay secret never reaches the app or the phone. Until the two keys below exist, the tab shows a setup notice: the watchlist and values still work, but no listings are fetched.

## The key to create

An **eBay Developers Program "Production" application keyset**. You need its **App ID (Client ID)** and **Cert ID (Client Secret)**.

1. Go to <https://developer.ebay.com> and sign in with an eBay account. Joining the Developers Program is free.
2. Open **Hi <name> → Application Keysets**. Name the application (for example `Cardstead`) and click **Create a keyset** under **Production**, not Sandbox.
3. eBay asks production keysets to handle **Marketplace Account Deletion** notifications. Cardstead stores no eBay user data: it only shows public listing titles and prices for a few minutes. So pick the exemption: **"I do not persist eBay data"** (Alerts & Notifications page of the keyset), and confirm.
4. Copy the production **App ID (Client ID)** and **Cert ID (Client Secret)**. The Dev ID is not needed, and no user token is needed: the app uses an *application* token (client-credentials grant, scope `https://api.ebay.com/oauth/api_scope`).

## Where to put it

Vercel → project **pokeflip-studio** → **Settings → Environment Variables**:

| Name | Value | Environments |
|---|---|---|
| `EBAY_CLIENT_ID` | the App ID (Client ID) | Production (and Preview if you test branches) |
| `EBAY_CLIENT_SECRET` | the Cert ID (Client Secret) | Production (and Preview) |

Then **Redeploy** the latest production deployment. Open Cardstead → **eBay deals**: the setup notice disappears and **Scan eBay now** is enabled. The Android app uses the same hosted function, so nothing else is needed for the phone.

Never paste these values into the code, a commit, an issue or a chat. If the secret leaks, delete the keyset on developer.ebay.com, create a new one and update Vercel.

## What the app does with it

- One search per watched card (`ebayQuery` in `sought-cards.js`):
  - category CCG Individual Cards;
  - Buy It Now only;
  - delivers to Canada;
  - ebay.ca marketplace;
  - up to 50 results, cheapest first.
- **Cache and limits**:
  - the function caches each search for 10 minutes and limits each visitor to 60 searches a minute;
  - a full scan of the 137 preloaded cards is 137 calls;
  - the hourly scan, which only runs while Cardstead is open, stays under the Browse API's default limit of 5,000 calls a day.
- **Filters**: listings with "proxy", "custom", "orica", "read description", empty boxes, lots, other languages, a wrong grade or a missing card number are left out.
- **Prices**: in CAD, including shipping. US-dollar listings are converted at the snapshot's Bank of Canada rate and labelled.
- **Verdict** against the card's dated market value:
  - green **Under value by $X (Y%)** when more than 5% under;
  - yellow **Fair** within 5%;
  - red **Over value**.
  Graded cards have no dated price source, so their value is **unknown**: set a **target price** to get alerts for them.
- **Alerts**: by default when a listing is at least **10% under value** (adjustable), or at or under your target price. Each listing alerts only once, and only when its shipping cost is known.

## The preloaded list

`sought-cards.js` holds 137 cards: 73 modern and 64 vintage, 116 raw and 21 graded (PSA 10 / PSA 9). They were picked on 23 Nov 2026 from PriceCharting set pages sorted by price and TCGplayer's top-seller report; each card links to the page that ranks it. Sources, doubtful entries and 65 alternates are in `docs/research/sought-cards-2026-11-23.md`.

To refresh after new sets come out, edit `sought-cards.js` (add or remove entries), then run `node tools/build-pack-ev.mjs` to refresh the TCGplayer prices. In the app, the owner can remove cards, restore them, add their own and set target prices.
