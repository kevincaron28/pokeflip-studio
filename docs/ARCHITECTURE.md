# Architecture

- **Frontend:** Static HTML/JS app, split into functional modules (`app.js` data core, `mycards.js`, `card-lookup.js`, `collection-value.js` daily price check, pricing, drops and alerts). Four tabs: Prices, Drops, My cards, Settings. Can deploy as static Vercel site.
- **Local data:** Browser localStorage. Export/restore JSON is required before importing, clearing, or syncing across devices. Purchase lots and sales recorded by older versions stay in the same data and backups, but have no screens any more.
- **Cloud:** Supabase Auth and an owner-scoped `pokeflip_snapshots` JSONB row with atomic, revision-checked RPC; manual push/pull, not realtime sync.
- **Card matching:** the person picks the exact card from the TCGdex catalogue (set and collector number) and its printing; no photo recognition (the camera scanner, OCR and symbol matching were removed on 25 November 2026).
- **Market pricing:** User-entered eBay sold comparisons with eligibility checks; no automatic licensed sold-data API at present. Prices must be marked with source/date/currency/variant and should not be confused with net proceeds.
- **Restocks:** Watch lists and unified imported alert inbox, NOT an always-on monitoring backend.
- **Hosting:** Existing Vercel project named `pokeflip-studio`; link source repo with Vercel Git integration for branch preview deployments.

## Data integrity rules
Server-side ownership is from authenticated session, not an email or client-supplied user ID. Cloud save checks optimistic `revision`; do not grant direct UPDATE. Imported JSON needs schema validation. Existing cloud snapshots should be downloaded before the first upload on a new device.

## Android (Capacitor)
`mobile/scripts/build-web.mjs` copies the PWA shell files (list parsed from `sw.js`) into `mobile/www`, replaces the CDN scripts with vendored copies, and adds `native-bridge.js`. Shared web files talk to native features only through `window.PokeFlipNative` when present. Auth return uses the `top.kcaron.cardstudio://auth` scheme. Details: `docs/ANDROID.md`.
