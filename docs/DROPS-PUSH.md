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
- **Not in the Android app** yet: its web view cannot receive Web Push. App push needs Firebase Cloud Messaging (a Firebase project: owner decision and account). Until then, Android users turn alerts on from Chrome.

## Owner steps
1. Make the keys once, on your computer: `node tools/make-vapid-keys.mjs`. Never commit them.
2. Supabase → Edge Functions → Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` = `https://pokeflip-studio.vercel.app/privacy.html`.
3. Vercel (and Cloudflare Pages) environment variable `VAPID_PUBLIC_KEY` (public; the site gives it to browsers through `/api/config`). Redeploy.
4. Supabase SQL Editor: run `migrations/004-push.sql` (after 002 and 003).
5. Deploy: `supabase functions deploy push-sender --project-ref fehvorwdcswhhonavyit`.
6. Supabase Cron: job `push-sender-tick`, schedule `* * * * *`, POST `{"task":"tick"}` with the secret key preset (same as `discord-drops-tick`).

The privacy policy now has a "Drop alerts" section (English and French). Add "push address and alert choices" to the Play data-safety form when the app gets push.

Cost: free tier (one call a minute, about 45,000 a month; push services are free).
