# Release verification — Cardstead (formerly PokéFlip Studio) v3.5 (2026-11-21)

- Source: https://github.com/kevincaron28/pokeflip-studio
- Hosted Vercel project: https://pokeflip-studio.vercel.app
- v3.5 adds explicit opt-in cloud autosave while the app is open, with revision conflict detection, and eBay/alert data-change signals.
- Local validation: 62 Node tests, Chromium mobile UI interaction with 1,200-entry inventory pagination, and cloud-autosave browser test using simulated Supabase calls. **Not an actual live account test.**
- Available TCGdex price context is shown with original currency, specific finish and last-update age; never silently converted or applied to inventory. Data may be missing or mismapped to variants.
- Database: dedicated Supabase project 3Canada Central3, owner RLS and atomic revision RPC verified earlier. The privileged RPC still requires a security review for multi-user production.
- Not yet verified: live email redirect and OTP; Pixel camera behavior; scanner labeled-photo accuracy benchmark; two-device cloud sync; authorized eBay sold feed; continuous third-party restock monitoring.
- CI workflow validates code and both Chromium acceptance tests on GitHub Actions; remote workflow status must be checked on each candidate commit.
- Vercel GitHub integration not yet authorized for push-triggered deployments. Manual GitHub-SHA deployment is available and previously confirmed READY.

The product is useful for pilot inventory, but the outstanding external/accuracy gates are tracked in GitHub issues #1–#6. Never describe them as completed until verified.

## Android wrapper (branch feat/android-capacitor)
- Added `mobile/` (Capacitor 8), CI `android.yml`, `docs/ANDROID.md`, `docs/PLAY-STORE-READINESS.md`. Web bundle assembly and unit tests pass locally; the Gradle/APK build is checked only by the GitHub Actions run.
- **Not verified:** installation on a Pixel, camera permission and live scan in the WebView, offline OCR in the WebView, email deep-link return, local notifications, back button, Play Store acceptance (the old name "PokéFlip" was a trademark risk; renamed Cardstead).
- Supabase Auth configured 2026-11-22 (Site URL https://pokeflip-studio.vercel.app; redirects `top.kcaron.cardstudio://auth`, `top.kcaron.cardstudio://**`, `https://pokeflip-studio.vercel.app/**`). Magic-link email template could not be edited (needs custom SMTP), so the typed `{{ .Token }}` code is not in the email yet. Remaining owner items: SMTP provider, upload keystore + 4 GitHub secrets, Pixel test. The Play developer account exists.
