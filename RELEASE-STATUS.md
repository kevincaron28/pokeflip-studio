# Release verification — Cardstead (formerly PokéFlip Studio) v3.5 (2026-11-21)

- 25 Nov 2026: focus on price checks and alerts. The camera scanner (OCR, set-symbol matcher, grading-photo screen, Android camera permission) and the portfolio pages (value graph, gain/loss dashboard, lots, sales) were removed; **My cards** replaces them. Older lots and sales stay in the data and backups.
- Source: https://github.com/kevincaron28/pokeflip-studio
- Hosted Vercel project: https://pokeflip-studio.vercel.app
- v3.5 adds explicit opt-in cloud autosave while the app is open, with revision conflict detection, and eBay/alert data-change signals.
- Local validation: 62 Node tests, Chromium mobile UI interaction with 1,200-entry inventory pagination, and cloud-autosave browser test using simulated Supabase calls. **Not an actual live account test.**
- Available TCGdex price context is shown with original currency, specific finish and last-update age; never silently converted or applied to inventory. Data may be missing or mismapped to variants.
- Database: dedicated Supabase project 3Canada Central3, owner RLS and atomic revision RPC verified earlier. The privileged RPC still requires a security review for multi-user production.
- Not yet verified: live email redirect and OTP; two-device cloud sync; authorized eBay sold feed; continuous third-party restock monitoring.
- CI workflow validates code and both Chromium acceptance tests on GitHub Actions; remote workflow status must be checked on each candidate commit.
- Vercel GitHub integration not yet authorized for push-triggered deployments. Manual GitHub-SHA deployment is available and previously confirmed READY.

The product is useful for pilot inventory, but the outstanding external/accuracy gates are tracked in GitHub issues #1–#6. Never describe them as completed until verified.

## Android wrapper (branch feat/android-capacitor)
- Added `mobile/` (Capacitor 8), CI `android.yml`, `docs/ANDROID.md`, `docs/PLAY-STORE-READINESS.md`. Web bundle assembly and unit tests pass locally; the Gradle/APK build is checked only by the GitHub Actions run.
- **Not verified:** installation on a Pixel, email deep-link return, local notifications, back button, Play Store acceptance (the old name "PokéFlip" was a trademark risk; renamed Cardstead).
- Supabase Auth configured 2026-11-22 (Site URL https://pokeflip-studio.vercel.app; redirects `top.kcaron.cardstudio://auth`, `top.kcaron.cardstudio://**`, `https://pokeflip-studio.vercel.app/**`). Magic-link email template could not be edited (needs custom SMTP), so the typed `{{ .Token }}` code is not in the email yet. Remaining owner items: SMTP provider, upload keystore + 4 GitHub secrets, Pixel test. The Play developer account exists.

## Canadian stock alerts (branch feat/canada-stock-alerts)
- Added one-tap "Check now" retailer links for 16 Canadian retailers and **automatic** checks for three allow-listed independent Shopify shops (app open only, ≥15 min per product). Big chains remain manual by design. Details: `docs/CANADA-STOCK-ALERTS.md`.
- Verified: unit tests, Chromium test with mocked shop responses, and a live fetch of one Shopify `.js` endpoint (CORS open, cents prices). **Not verified:** search-URL templates for big chains, polling inside the Android WebView, notification delivery on a device. No background/server push exists yet.
- Follow-a-region (branch feat/canada-regions): 74 independent Shopify card shops grouped into 14 regions, checked while the app is open (30 min per shop). Results are possible matches to verify, never verified observations. Probe results are in `docs/research/`; domain matching from Discord channel names is a guess validated by each shop's own name. Not run on a phone or in CI yet.
- Fast checkout (branch feat/fast-checkout): per-watch max price/quantity/limit, "Ready to buy" panel with Buy now links (Shopify cart permalink, Amazon.ca add-to-cart, otherwise product page), checkout tips in Settings, Android Custom Tab via `@capacitor/browser`. No payment data stored, no auto-purchase. Unit and Chromium tests pass; not verified on a device or against live checkouts.
