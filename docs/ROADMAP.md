# Release backlog — blockers in priority order

## P0: Hosted acceptance
- [ ] Create private `pokeflip-studio` GitHub repository under the owner's account and push all files from this source package.
- [ ] Connect repo to existing Vercel project `pokeflip-studio` and deploy a preview; verify routing/assets/security headers and all tabs.
- [ ] Set Supabase Auth Site URL and redirect allowlist to deployed URL and verify magic-link/OTP sign-in from a real inbox.
- [ ] Verify manual cloud push/pull from two different devices, revision conflict, expired sessions, and backup restore.
- [ ] Independent security review for `pokeflip_save_snapshot` SECURITY DEFINER/RLS/payload limits.

## P0: Card scanning acceptance
- [ ] Collect owner-authorized, labeled photos of 100+ physical cards: FR/EN, reverse-holo, duplicate art across sets, vintage symbol layouts, blurry photos, different light.
- [ ] Measure exact printing top-1/top-3 accuracy, false confident matches, OCR/number extraction, per-scan latency, symbol crop accuracy and review rate.
- [ ] Improve capture guidance, autofocus, manual fallback, dataset coverage, and reject uncertain matches.
- [ ] Validate preliminary grading screen on front/back/angled photos; do not predict PSA grades without scientific validation.

## P1: Pricing and restocks
- [ ] Obtain authorized eBay sold-history feed/license or preserve user-verified sold comparisons; add sold-price provenance and currency conversion tests.
- [ ] Add authorized retailer/feed integrations for regional restocks, scheduled refresh, deduplication, and rate limits; no scraping protected sites.
- [ ] Add opt-in push notifications with subscriptions, unsubscribe, and a tested notification service.

## P1: Product quality
- [ ] Persistent photo storage, privacy controls, backup policy, 1000+ item performance tests, observability, accessibility testing, and French UI localization.
- [ ] Define documented beta exit criteria, recovery strategy and on-call/error monitoring.

## Currently verified
- 50 Node tests; embedded Chromium test for navigation, lot creation, 100-card bulk entry. Neither tests real camera nor hosted cloud.
