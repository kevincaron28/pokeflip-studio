# Cardstead Drop Assist (Chrome extension)

It watches the Amazon.ca and Pokémon Center Canada products you choose. When one is in stock at or under your max price, it:
1. alerts you loudly: a big green banner, an alarm sound, a Chrome notification and, if you want, a push to your phone;
2. puts your quantity in the cart, never more than your max or the store's limit;
3. opens checkout with the address and payment you already saved in your Amazon or Pokémon Center account.

**You click "Place order" yourself.** The extension refuses to press "Place order", "Buy Now" or "1-Click".

## Install (about 2 minutes)

1. Download the Cardstead code from GitHub (green **Code** button → **Download ZIP**) and unzip it. You need the folder named `extension` inside.
2. In Chrome, type `chrome://extensions` in the address bar and press Enter.
3. Turn on **Developer mode** (switch at the top right).
4. Click **Load unpacked** and pick the `extension` folder.
5. Click the puzzle piece in the toolbar, then the pin next to **Cardstead Drop Assist**, so its icon stays visible.
6. Sign in to **amazon.ca** and **pokemoncenter.com/en-ca** in this same Chrome, and save your address and card in each store's own account. The extension never asks for them.

To update later, replace the folder with the new one and click the round arrow on the extension's card in `chrome://extensions`.

## Use it

Click the extension icon:
- **Add a product**: paste an Amazon.ca link (or the 10-character ASIN) or a Pokémon Center Canada product link. Give it a name, your **max price** and your **max quantity**.
- Each product has **Pause / Turn on**, **Check now** and **Remove**. For Amazon, **Only when sold by Amazon.ca** is on by default, so third-party resellers at scalper prices are skipped.
- **Settings**:
  - check interval: 3 minutes by default, 2 at least, with a little randomness;
  - "Add to cart and open checkout" or "Alert only";
  - loud sound;
  - phone push.
- **What Drop Assist did** lists every check, drop, queue and step it took.

**Phone push (optional)**: install the free **ntfy** app, subscribe to a long, hard-to-guess topic name (for example `cardstead-7fk29x-drops`), and type the same name in Settings. No account is needed. Anyone who knows the name can read the alerts.

**Cardstead alerts**: when Cardstead (pokeflip-studio.vercel.app, open in the same Chrome) records an in-stock alert with an Amazon.ca or Pokémon Center link for a product you watch, the extension checks it right away. It never checks the same product more than once a minute.

## How it behaves

- **Amazon.ca**: a background check of each product page, at most every 2 minutes and every 3 by default, using your own signed-in session. If Amazon shows a robot check, the extension stops for 30 minutes and tells you. It never solves it.
- **Pokémon Center Canada**: a pinned tab per product, reloaded at the same polite pace. When the **waiting room** appears, the extension stops reloading, keeps the tab from being put to sleep, tells you that you are in line, and alerts you when you are through. It never skips the line or solves a CAPTCHA.
- **A drop is handled once every 30 minutes per product**, so you never get a cart full of copies.
- **Stored on this computer only** (Chrome storage): your product list, settings and log. No passwords, no card numbers.

Not tested on the live stores yet: Amazon and Pokémon Center change their pages often. The tests use pages written to look like theirs, not copies. On the first real drop, watch it work, and use "Alert only" if anything looks wrong. Tell Cardstead's developer what the log shows.

## Why checkout assist, and how it compares

| Option | Speed on a drop | Risk to your account | What you still do |
|---|---|---|---|
| **Store "notify me" buttons** (Amazon, Pokémon Center emails) | Slow: emails often arrive after it sells out | None | Everything |
| **Phone app alerts** (Cardstead and similar) | Fast alert | None | Open the store, add to cart, check out on a small screen |
| **Discord monitors** (Pokénnoisseur, Pokewatch…) | Fastest alert, often seconds | None | Same as above, and you share the drop with thousands of people |
| **Checkout assist** (this extension) | Fast: the cart and checkout are already open when you look | Low: it uses your normal browser and session at a human pace, and you place the order | One click on "Place order" |
| **Full auto-buy bots** | Fastest | **High**: both stores forbid automated buying. Pokémon Center cancels bot orders and can ban accounts, Amazon can close accounts, and bots fight queues and CAPTCHAs | Nothing, until the account is gone |

Checkout assist is the safest way not to miss drops. It removes the slow steps (finding the page, quantity, cart, checkout) but keeps a person on the final click. It checks at a polite pace, respects the queue and CAPTCHAs, and never buys on its own. Use it together with a Discord monitor or Cardstead alerts: the alert gets you there, and the extension saves the clicks.
