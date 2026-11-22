# Architecture

- **Frontend:** Static HTML/JS app, split into functional modules (`app.js`, `card-lookup.js`, `identity-guard.js`, `symbol-match.js`, pricing, inventory and alerts). Can deploy as static Vercel site.
- **Local data:** Browser localStorage. Export/restore JSON is required before importing, clearing, or syncing across devices. Photos are not currently persisted.
- **Cloud:** Supabase Auth and an owner-scoped `pokeflip_snapshots` JSONB row with atomic, revision-checked RPC; manual push/pull, not realtime sync.
- **Card matching:** TCGdex catalog with exact-set/collector number when available; OCR and symbol matching are aids with uncertain results reviewed manually. Do not assert high confidence without a labeled photo benchmark.
- **Market pricing:** User-entered eBay sold comparisons with eligibility checks; no automatic licensed sold-data API at present. Prices must be marked with source/date/currency/variant and should not be confused with net proceeds.
- **Restocks:** Watch lists and unified imported alert inbox, NOT an always-on monitoring backend.
- **Hosting:** Existing Vercel project named `pokeflip-studio`; link source repo with Vercel Git integration for branch preview deployments.

## Data integrity rules
Server-side ownership is from authenticated session, not an email or client-supplied user ID. Cloud save checks optimistic `revision`; do not grant direct UPDATE. Imported JSON needs schema validation. Existing cloud snapshots should be downloaded before the first upload on a new device.

## Android (Capacitor)
`mobile/scripts/build-web.mjs` copies the PWA shell files (list parsed from `sw.js`) into `mobile/www`, replaces the CDN scripts with vendored copies, and adds `native-bridge.js`/`ocr-local.js`. Shared web files talk to native features only through `window.PokeFlipNative` when present. Auth return uses the `top.kcaron.cardstudio://auth` scheme. Details: `docs/ANDROID.md`.
