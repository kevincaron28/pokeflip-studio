# Drop alerts by push notification

Status 24 Nov 2026. Reads `public.drop_events` (filled by the shop checker, `docs/DROPS-PIPELINE.md`, and later by retailer emails and the Amazon API) and sends one Web Push notification per drop to members who turned alerts on.

## What members see
Settings → **Drop alerts on this device** → *Turn on drop alerts*. Needs a signed-in Cardstead account (Backup and cloud). Choices: only at or under market value + 10% (default on), include big chains (default on). The area comes from **My area & stores** (Québec → Montréal area and other Québec regions, plus Canada-wide online shops).

Notification: "In stock: Delta Reign Booster Box" / "Hasty Cards, Toronto · $279.99 · market price · check before you go". Tapping opens the store's product page. French for members using Cardstead in French.

## Rules
- Only in-stock sightings, never Low confidence, never marketplace sellers.
- One push per member per product at a store per 30 minutes.
- By default, not when the price is over the market value + 10%.
- A browser that has dropped the subscription (404/410 from its push service) is removed.

## Where it works
- Website in Chrome, Edge or Firefox (desktop and Android), and Safari on iPhone once Cardstead is added to the Home Screen.
- **Android app**: through Firebase Cloud Messaging (FCM), switched off until the owner adds a Firebase config (steps below). Until then the app tells members to turn alerts on from Chrome on the same phone.

## Owner steps
1. Make the keys once, on your computer: `node tools/make-vapid-keys.mjs`. Never commit them.
2. Supabase → Edge Functions → Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` = `https://pokeflip-studio.vercel.app/privacy.html`.
3. Vercel (and Cloudflare Pages) environment variable `VAPID_PUBLIC_KEY` (public; the site gives it to browsers through `/api/config`). Redeploy.
4. Supabase SQL Editor: run `migrations/004-push.sql` (after 002 and 003).
5. Deploy: `supabase functions deploy push-sender --project-ref fehvorwdcswhhonavyit`.
6. Supabase Cron: job `push-sender-tick`, schedule `* * * * *`, POST `{"task":"tick"}` with the secret key preset (same as `discord-drops-tick`).

## Price alerts with the app closed (optional)
Members who tick *Also when a card on my Watchlist reaches my target price* get one notification a day at most per device. Only cards that match exactly are checked: ungraded, English, Near Mint, added from a set page, priced from TCGplayer sales (`supabase/functions/_shared/price-alerts.mjs`). Targets come from the member's cloud backup. Price data older than 3 days sends nothing.

Owner steps (after the steps above):
1. Deploy again: `supabase functions deploy push-sender --project-ref fehvorwdcswhhonavyit`.
2. Supabase Cron: job `push-sender-prices`, schedule `0 15 * * *` (after the daily price refresh), POST `{"task":"prices"}` with the same secret key preset as `push-sender-tick`.
3. Vercel (and Cloudflare Pages) environment variable `PRICE_ALERTS` = `1`, then redeploy. This shows the choice in Settings.

## Android app push (Firebase), owner steps
The app code is ready and stays off until these are done. Firebase Cloud Messaging is free (no paid plan needed; the free Spark plan is enough).

**Use the existing Firebase account?** Yes, if you like. One Firebase project can hold several Android apps, so the project the Guilded phone app uses can also hold Cardstead: open that project and add a second Android app. A separate project ("Cardstead") is cleaner if you ever want to hand Cardstead over or keep its users apart; it costs the same (nothing). Either works with the steps below.

1. [Firebase console](https://console.firebase.google.com) → open the project (or **Add project** → "Cardstead", Google Analytics off).
2. **Project overview → Add app → Android**. Package name: `top.kcaron.cardstudio` (must match exactly). Nickname: Cardstead. Skip the SHA-1 (not needed for push). **Register app**.
3. **Download google-services.json**. Do not commit it. Either:
   - for a build on your computer: put it at `mobile/android/app/google-services.json` (git ignores it), or
   - for the GitHub build: repository **Settings → Secrets and variables → Actions → New repository secret**, name `GOOGLE_SERVICES_JSON`, value = the whole file's text. The Android workflow writes the file before building.
   Skip the "Add Firebase SDK" screens; the app already has it.
4. **Project settings → Cloud Messaging**: check that *Firebase Cloud Messaging API (V1)* is **Enabled** (enable it if it says disabled).
5. **Project settings → Service accounts → Generate new private key**. This downloads a JSON key: it is a secret. Supabase → Edge Functions → Secrets → add `FIREBASE_SERVICE_ACCOUNT` = the whole file's text. Then delete the downloaded file from your computer. Never paste it into a chat or commit it.
6. Supabase SQL Editor: run `migrations/005-push-fcm.sql` (after 004).
7. Redeploy the sender: `supabase functions deploy push-sender --project-ref fehvorwdcswhhonavyit`.
8. Build a new app version (tag a release or run the Android workflow), install it, Settings → **Turn on drop alerts**, allow notifications. Android 13 and later ask for permission at that moment.
9. Play Console → App content → **Data safety**: add "Device or other IDs" (push token), purpose App functionality, linked to the account, deletable.

Without step 5 the sender skips app devices (browser alerts keep working). Without step 3 the app keeps showing "cannot receive these alerts yet".

The privacy policy now has a "Drop alerts" section (English and French). Add "push address and alert choices" to the Play data-safety form when the app gets push.

Cost: free tier (one call a minute, about 45,000 a month; push services are free).
