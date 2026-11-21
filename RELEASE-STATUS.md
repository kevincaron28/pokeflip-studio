# PokéFlip Studio — Release verification (November 21, 2026)

## Deployment and source control

- GitHub repository: https://github.com/kevincaron28/pokeflip-studio
- Vercel production URL: https://pokeflip-studio.vercel.app
- Existing Vercel project `pokeflip-studio`, production deployment for commit `b98fc5f12a9930a7019ac40a712ecd0889ac30e8` reported **READY**.
- Preview deployments remain protected; production is configured for public access. Availability in every browser/network is **not** yet end-to-end verified.
- All application text files and PWA PNG icons were imported to GitHub.
- Continuous GitHub -> Vercel deployment is **not** configured until the Vercel GitHub integration is authorized for the repository.

## Verified previously

- 50 automated JavaScript/business-logic tests passed in the supplied v3.2 source release.
- Simulated Chromium mobile workflow navigated tabs and recorded a purchase lot and 100-card French bulk entry.
- Dedicated Supabase project in Canada Central is active. RLS enabled, anonymous inserts denied, direct authenticated table updates denied, and authenticated snapshot RPC present.
- Vercel confirms a production deployment is READY, not merely a local ZIP.

## Unverified / incomplete production gates

1. **Auth/cross-device:** Supabase Site URL and redirect configuration, email OTP/magic link, two-device snapshot synchronization and conflict/rollback need real-account acceptance. [#1](https://github.com/kevincaron28/pokeflip-studio/issues/1)
2. **Scanner:** independent labeled-photo benchmark for FR/EN expansion, collector number, visually identical artworks, reverse/holo variants and grade-potential evidence. [#2](https://github.com/kevincaron28/pokeflip-studio/issues/2)
3. **eBay:** authorized automated sold-data feed is not connected. Manual sold-comparable ledger works. [#3](https://github.com/kevincaron28/pokeflip-studio/issues/3)
4. **Restock:** always-on source polling and phone push are not connected; use provider alerts and manual inbox. [#4](https://github.com/kevincaron28/pokeflip-studio/issues/4)
5. **CI/deployment acceptance:** confirm GitHub Actions builds, install Vercel GitHub integration, asset HTTP/HTTPS checks, operational monitoring. [#5](https://github.com/kevincaron28/pokeflip-studio/issues/5)
6. **Security:** review the intentional authenticated SECURITY DEFINER function, RLS isolation, backup recovery and multi-user access. [#6](https://github.com/kevincaron28/pokeflip-studio/issues/6)

## Safety rules

- Never save a card at a confident price based only on a matching artwork; verify exact set, collector number, foil and language.
- Do not mislabel asking prices as eBay sold transactions.
- No private Discord self-bots or unauthorized restock scraping.
- Do not commit .env, service-role keys, credentials, exported inventories, personal card photos, or private customer data.
- Preserve regular JSON backups until cloud restore is proven.
