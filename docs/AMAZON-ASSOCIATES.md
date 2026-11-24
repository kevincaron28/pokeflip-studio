# Amazon Associates (Amazon.ca)

Owner decision, 24 Nov 2026: Cardstead's Amazon.ca links earn Associates commission, and Drop Assist no longer buys automatically on Amazon.

## How the tag works
- **One setting**: the environment variable `AMAZON_ASSOCIATES_TAG` (your Amazon.ca tracking id, it ends in `-20`). No tag is written in the code; a test checks that.
  - Vercel: Project > Settings > Environment Variables > `AMAZON_ASSOCIATES_TAG` (Production), then redeploy.
  - Cloudflare Pages: Settings > Variables and Secrets > `AMAZON_ASSOCIATES_TAG`, then redeploy.
- `/api/config` serves it (`api/_config-core.js`, shared by `api/config.js` and `functions/api/config.js`). `affiliate.js` loads it once, keeps it 12 hours on the device, and tags every amazon.ca link Cardstead builds:
  - product pages and searches: `?tag=<id>`;
  - the "Buy now" add-to-cart link: `AssociateTag=<id>`.
  - Only amazon.ca. Other stores, and amazon.com, are never changed.
- Without the setting nothing changes: links stay untagged and the disclosure stays hidden.

## Disclosure (required by the Associates agreement)
"As an Amazon Associate Cardstead earns from qualifying purchases." appears in the site footer and at the top of Settings as soon as a tag is set. The Android app uses the same pages, so it shows there too.

Google Play: affiliate links are allowed when they are not the app's main purpose and are labelled; the Settings panel says what the tag is and that it does not change the price. Mention it in the Play listing's description if the Associates account is approved.

## What the owner must do
1. Apply at associates.amazon.ca with the site (https://pokeflip-studio.vercel.app) and the Android app. Amazon reviews the application only after **3 qualifying sales within 180 days**; personal orders don't count, and a rejected account can't be reinstated.
2. Tax interview and payment details in Associates Central (only you can do these).
3. Put the tracking id in `AMAZON_ASSOCIATES_TAG` on Vercel (and Cloudflare Pages).

## Amazon's product API (stock and price)
The Product Advertising API was replaced in 2026 by the **Creators API** (new credentials, OAuth). Amazon's docs say it needs an approved Associates account and recent qualifying sales (the US docs say 10 in the last 30 days; the Canadian number is not confirmed), and access pauses when sales drop below it. Until then, Amazon stock is watched through Amazon's own emails and member reports, never by reading Amazon's pages.

## Drop Assist (Chrome extension)
Automatic checkout is switched off in `extension/lib/core.js` (`AUTO_CHECKOUT_ENABLED=false`): Amazon's Conditions of Use forbid automated buying, and the Associates account must stay in good standing. Checkout assist still opens the product and checkout; you click "Place your order" yourself.

Still to decide: the extension's background check of watched Amazon product pages (every 2–3 minutes with your signed-in session) is also automated access to Amazon's site. Once the Creators API is unlocked, it should be replaced by the API.
