# Cardstead — release backlog (2026-11-21)

## Delivered and verified
- [x] Source committed to GitHub: https://github.com/kevincaron28/pokeflip-studio
- [x] Deployed to Vercel at https://pokeflip-studio.vercel.app (READY on latest published commit).
- [x] Dedicated Canada Central Supabase project; RLS, owner-only SELECT, atomic revision-controlled saves; unprivileged public RPC wrapper around non-exposed internal writer. Supabase security advisor shows zero warnings.
- [x] Browser tested mobile navigation, lot purchase, 100-card bulk intake, cloud autosave conflicts in a mocked environment, and filtering 1,200 separate inventory records.
- [x] TCGdex TCGplayer/Cardmarket reference quotes shown as USD/EUR with source/age warnings, never treated as confirmed CAD sold sales.
- [x] Conservative eBay documented sold-price comparisons; duplicate and unsubstantiated observations do not count toward an estimated price.

## P0: Live acceptance before broad public launch
- [ ] Configure Supabase Authentication Site URL and redirect allowlist for https://pokeflip-studio.vercel.app; verify real magic link or OTP email.
- [ ] Verify the actual Pixel camera, lighting, bottom-symbol focus and French/English card identification from real photos.
- [ ] Run live two-account RLS tests, two-device cloud backup/restore and conflict exercises using authorized test identities (current browser test uses a mock).
- [ ] Enable Vercel GitHub App authorization for automatic push-to-deploy; confirm GitHub Actions checks are visible and green.
- [ ] Real HTTPS assets, PWA install and operational monitoring acceptance checks.

## P1: External integrations requiring source authorization
- [ ] Obtain legal/authorized eBay sold-sales data access or maintain user-supplied Product Research comparables. No scraping protected APIs.
- [ ] Authorized Canadian retailer/alert-provider feeds, recurring server polling, freshness/deduplication, and opt-in push notifications to Android. Do not fabricate live stock.
- [ ] Optional saved scan photos and scalable encrypted backing storage with a documented privacy policy.

## Quality and expansion
- [ ] Benchmark a labeled set of at least 100 real FR/EN cards (exact printing, holo variant, symbol, condition) before advertising automatic accuracy.
- [ ] Accessibility and French-UI localization review; recoverability and 10,000-entry load benchmark.
- [ ] Clear support/incident protocol, backed-up data export and rollback playbook.

Production build readiness is **not** equivalent to completion of all live acceptance gates. See GitHub issues #1–#6.

- [ ] Android (Cardstead): set up custom SMTP so the Supabase magic-link email can carry the 6-digit code; add upload keystore secrets; test on a Pixel (camera, offline OCR, deep link, notifications); host privacy policy and account-deletion page.

- [ ] Background stock alerts: server poller for allow-listed Shopify shops + FCM/Web Push (design in docs/CANADA-STOCK-ALERTS.md); needs owner decisions on hosting, Firebase and privacy policy.

- [ ] Cardstead Drops Discord server: bot built (docs/DISCORD-DROPS.md); owner creates the bot application, pastes the token into Supabase secrets, runs the migration, deploys, runs setup and the cron jobs; launch after the server-side checker catches real drops.
