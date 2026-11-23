# Cardstead Drop Assist (Chrome extension)

It watches the Amazon.ca and Pokémon Center Canada products you choose. When one is in stock at or under your max price, it:
1. alerts you loudly: a big green banner, an alarm sound, a Chrome notification and, if you want, a push to your phone;
2. puts your quantity in the cart, never more than your max or the store's limit;
3. opens checkout with the address and payment you already saved in your Amazon or Pokémon Center account.

**You click "Place order" yourself.** The extension refuses to press "Place order", "Buy Now" or "1-Click", except in **automatic checkout**: an Amazon.ca-only option that is off by default and switched on product by product (see below).

## Install (about 3 minutes)

1. Download the Cardstead code from GitHub (green **Code** button → **Download ZIP**) and unzip it. You need the folder named `extension` inside. Keep it somewhere it will stay, like Documents.
2. In Chrome, type `chrome://extensions` in the address bar and press Enter.
3. Turn on **Developer mode** (switch at the top right).
4. Click **Load unpacked** and pick the `extension` folder.
5. Click the puzzle piece in the toolbar, then the pin next to **Cardstead Drop Assist**, so its icon stays visible.
6. Sign in to **amazon.ca** and **pokemoncenter.com/en-ca** in this same Chrome, and save your address and card in each store's own account. The extension never asks for them.
7. In Amazon, make the address you want deliveries at your **default address** and the card your **default payment method**. Automatic checkout only uses those defaults, and stops if Amazon asks to choose.
8. Click the extension icon and add your products (see "Use it").
9. For automatic checkout, also do "Turn on automatic checkout" below.

**To update** (for example to get automatic checkout):
1. Download the new ZIP and replace the old `extension` folder with the new one, in the same place.
2. In `chrome://extensions`, click the round arrow on the **Cardstead Drop Assist** card.

Your products, settings and log are kept.

## Automatic checkout (Amazon.ca only, off by default)

**Read this first.** Amazon's Conditions of Use forbid robots and automated buying. Amazon can cancel orders placed this way, and it can suspend or close your account, including your order history and any gift card balance. You use this at your own risk. **Pokémon Center is never bought automatically**: it stays checkout assist, and the waiting room and CAPTCHAs are never bypassed.

**Turn on automatic checkout**:
1. Open the extension's settings. Under **Automatic checkout**, tick **I understand the Amazon terms risk**.
2. Fill in:
   - your **daily spending cap** for all products;
   - the **postal code** of your Amazon delivery address;
   - optionally the street, and other sellers you trust besides Amazon.ca.
3. Click **Save automatic checkout settings**.
4. On each Amazon.ca product you want bought for you:
   - set **Max price** (per unit), **Max quantity** and **Max order total incl. tax & shipping**;
   - tick **Automatic checkout**.

**What happens on a drop**:
1. It checks that the product is in stock, sold by Amazon.ca, and at or under your max price. It also checks that the estimated order fits today's cap.
2. It sets your quantity and presses **Buy Now**.
3. On Amazon's checkout page, it re-reads the page just before the last click. It buys **nothing** and leaves checkout open for you, with a loud alert saying why, if any of these is true:
   - the order total, with tax and shipping, is above the product's max order total or the rest of today's cap;
   - the unit price is above your max;
   - the quantity is not exactly yours, or there is more than one item;
   - the seller is not Amazon.ca or your allowlist;
   - the delivery address does not match your postal code (and street, if set);
   - Amazon asks to choose or confirm a payment, a CVV, a CAPTCHA or a code;
   - Amazon opens its quick-checkout window instead of the checkout page.
4. Otherwise it presses **Place your order once**. You get a loud alert and a phone push, and tapping either opens the order on Amazon, where you can **cancel** it.
5. **At most one order per product per drop, never retried.** If Amazon shows no confirmation, you get an alert to check your orders, and it does not try again.

Every attempt and order is logged with time, quantity, unit price, total and result under **Orders and attempts**, with a link to each order.

Not tested on the live Amazon site: Amazon's checkout pages change often. The tests use pages written to look like Amazon's, not copies. Start with a cheap product and a low daily cap, and watch the first order happen. If anything looks wrong, untick **Automatic checkout**: the product goes back to checkout assist.

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
| **This extension's automatic checkout** (Amazon.ca, opt-in) | Fastest: the order is placed in seconds | **Real**: Amazon forbids automated buying and can cancel orders or close the account. The caps and checks limit the money at stake, not the account risk | Nothing, or cancel it from the alert |
| **Full auto-buy bots** | Fastest | **High**: both stores forbid automated buying. Pokémon Center cancels bot orders and can ban accounts, Amazon can close accounts, and bots fight queues and CAPTCHAs | Nothing, until the account is gone |

Checkout assist is the safest way not to miss drops. It removes the slow steps (finding the page, quantity, cart, checkout) but keeps a person on the final click. It checks at a polite pace, respects the queue and CAPTCHAs, and never buys on its own. Use it together with a Discord monitor or Cardstead alerts: the alert gets you there, and the extension saves the clicks.
