# Release verification — PokéFlip Studio v3.4 (2026-11-21)

- Source: https://github.com/kevincaron28/pokeflip-studio
- Hosted Vercel project: https://pokeflip-studio.vercel.app
- v3.4 adds explicit opt-in cloud autosave while the app is open, with revision conflict detection, and eBay/alert data-change signals.
- Local validation: 56 Node tests, Chromium mobile UI interaction with 1,200-entry inventory pagination, and cloud-autosave browser test using simulated Supabase calls. **Not an actual live account test.**
- Database: dedicated Supabase project 3Canada Central3, owner RLS and atomic revision RPC verified earlier. The privileged RPC still requires a security review for multi-user production.
- Not yet verified: live email redirect and OTP; Pixel camera behavior; scanner labeled-photo accuracy benchmark; two-device cloud sync; authorized eBay sold feed; continuous third-party restock monitoring.
- CI workflow validates code and both Chromium acceptance tests on GitHub Actions; remote workflow status must be checked on each candidate commit.
- Vercel GitHub integration not yet authorized for push-triggered deployments. Manual GitHub-SHA deployment is available and previously confirmed READY.

The product is useful for pilot inventory, but the outstanding external/accuracy gates are tracked in GitHub issues #1–#6. Never describe them as completed until verified.
