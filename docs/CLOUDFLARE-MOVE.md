# Moving Cardstead from Vercel Hobby to Cloudflare Pages

Why: Vercel Hobby is for personal, non-commercial use only. Cardstead supports a resale business, so it needs Vercel Pro (about $28 CAD a month) or another host. The owner chose the free option, Cloudflare Pages. Its free plan allows commercial use. See the limitations audit, item C1.

Status: the code is ready and tested locally. Vercel keeps serving production until the cut-over below.

## What moves

| Today on Vercel | On Cloudflare | Notes |
|---|---|---|
| Static app (every file except `mobile/`) | Pages static assets (`dist/`, built by `node tools/build-pages.mjs`) | Same files. `api/` source and host config are not published. |
| Security headers from `vercel.json` | `_headers` (generated) + `functions/_middleware.js` | Both read `vercel.json`, so there is one source of truth. The CSP (about 2,850 characters) is over Pages' 2,000-character `_headers` line limit, so the middleware sends the full set on the pages, `sw.js` and `/api/*`. |
| `api/ebay-search.js` (Node function) | `functions/api/ebay-search.js` (Pages Function, a Worker) | Shared logic in `api/_ebay-core.js`. Both hosts answer identically. Cloudflare also keeps a successful search 10 minutes in its edge cache. |
| Cron jobs | **None to port** | `vercel.json` has no crons. The daily price refresh (`refresh-prices.yml`) and the hourly live smoke test (`live-smoke.yml`) run on GitHub Actions. Restock checks run on the user's device while the app is open. |

A server-side restock poller (audit items C2 and C6: one poller instead of every phone polling every shop) would be a separate Worker with a Cron Trigger. Pages projects cannot have cron triggers. That is a new feature, not part of this move.

## Free-plan limits that apply

- **Static requests**: free and unlimited.
- **Pages Functions**: count toward the Workers free plan of 100,000 requests a day. That covers page loads, `sw.js` checks and eBay searches, but not scripts, styles, images or data files.
- **Other limits**: 500 builds a month, 20,000 files and 25 MiB per file. Cardstead's build is about 2 MB.
- **Function CPU**: 10 ms per request. Waiting on eBay does not count.

## Environment variables

Set these in Cloudflare: **Workers & Pages > cardstead > Settings > Variables and Secrets**, for both Production and Preview. They are typed in the dashboard only, never in the repository.

| Name | Type | Value |
|---|---|---|
| `EBAY_CLIENT_ID` | Secret | eBay production keyset App ID (once eBay approves the account; until then the app says "eBay not connected yet") |
| `EBAY_CLIENT_SECRET` | Secret | eBay production keyset Cert ID |
| `CARDSTEAD_ORIGINS` | Text, optional | Extra origins allowed to call `/api/ebay-search` cross-origin, comma-separated, `https://` only. Example: `https://cardstead.pages.dev,https://cardstead.kcaron.top`. Same-origin calls from the site need nothing. The Android app (`https://localhost`) is always allowed. |

Supabase's URL and anon key are public and live in the app code; nothing to set. GitHub repository variable (Settings > Secrets and variables > Actions > Variables): `CARDSTEAD_URL`, read by the smoke tests (see the cut-over).

## Step 1: run both side by side (no change for users)

1. Cloudflare dashboard: **Workers & Pages > Create > Pages > Connect to Git**, then pick `kevincaron28/pokeflip-studio`.
   - Production branch: `main`.
   - Build command: `node tools/build-pages.mjs`.
   - Build output directory: `dist`.
   - Root directory: leave empty.
   - Project name: `cardstead`. The URL becomes `https://cardstead.pages.dev`; if the name is taken, Cloudflare adds a suffix, so use the URL it shows.
2. Add the variables above (eBay keys only if eBay has approved the account).
3. Every push now builds a preview (`https://<branch>.cardstead.pages.dev`), and `main` builds `https://cardstead.pages.dev`. Vercel still serves `pokeflip-studio.vercel.app`, and no DNS changes.
4. Supabase dashboard: **Authentication > URL Configuration > Redirect URLs**, then add `https://cardstead.pages.dev/**` and `https://*.cardstead.pages.dev/**`. This makes email sign-in links work on the preview. Leave the **Site URL** on Vercel for now.
5. Verify the preview:
   - `POKEFLIP_URL=https://cardstead.pages.dev/ node tests/production-smoke.mjs` should pass: every file, theme, manifest, service worker list and the nosniff and frame-deny headers.
   - `POKEFLIP_URL=https://cardstead.pages.dev/ python tests/live-browser.py` should pass with zero page errors under the real CSP.
   - `curl -sI https://cardstead.pages.dev/` should show `content-security-policy`, `x-frame-options: DENY` and `x-content-type-options: nosniff`.
   - `curl -s "https://cardstead.pages.dev/api/ebay-search?status=1"` should return `{"configured":false,...}` without keys, or `{"configured":true}` with them.
   - Sign in by email on the preview (once custom SMTP is set) and check sync.

All of these already pass on a local Cloudflare build: `npm run pages:dev`, then use `http://127.0.0.1:8788`.

## Step 2: the cut-over (coordinator; only after Step 1 is verified)

Pick the address. `https://cardstead.kcaron.top` is suggested: kcaron.top is already on Cloudflare DNS, and nothing uses `cardstead.kcaron.top` (checked 23 November 2026).

1. **Domain**: Pages > cardstead > **Custom domains > Set up a domain**, enter `cardstead.kcaron.top`. Cloudflare adds the CNAME in the same zone and issues the certificate.
2. **Users' saved data (the important one)**: browsers keep Cardstead's local data per address. On the new address the app starts empty, unless the user signed in to cloud sync or imports a backup.
   - Before announcing the move, ship a short notice on the Vercel copy: "Cardstead moved: Export backup here, then open cardstead.kcaron.top and Import it (or sign in to sync)."
   - Keep Vercel up while people move. Add a redirect only after that (see step 9).
3. **One code PR** after the domain exists:
   - `ebay-watch.js` line 89: the Android app's API origin (`https://pokeflip-studio.vercel.app`) becomes `https://cardstead.kcaron.top`.
   - `api/_ebay-core.js` `BASE_ORIGINS`: add the new origin. Keep the old one during the move.
   - `extension/manifest.json`: add `https://cardstead.kcaron.top/*` to the `cardstead-signal.js` match, keeping the old one, and raise the extension version.
   - `tests/production-smoke.mjs`, `tests/live-browser.py` and `tools/probe-shopify-shops.py`: update the default URL or origin.
   - `README.md`, `extension/README.md` and `RELEASE-STATUS.md`: update the links.
4. **Android app**: the API origin is compiled into the app, so build a new APK or AAB after the PR. The owner releases it to Play; this move triggers no release by itself. Until users update, the old app keeps calling Vercel, so keep Vercel's eBay function and keys until then. Email sign-in in the app is unaffected: it uses the app's own `top.kcaron.cardstudio://auth` link.
5. **Supabase**: Authentication > URL Configuration.
   - **Site URL**: `https://cardstead.kcaron.top`.
   - **Redirect URLs**: add `https://cardstead.kcaron.top/**`. Keep the Vercel and app-scheme entries until the move is over.
6. **Drop Assist (Chrome extension)**: it is installed unpacked, so each user reloads it from the updated folder (chrome://extensions > reload). It only watches the Cardstead site to read alerts. Its Amazon and Pokémon Center pages and its settings do not change.
7. **GitHub**: set the repository variable `CARDSTEAD_URL` to `https://cardstead.kcaron.top/`. The hourly live smoke test and CI's deployed-site check then test the new site.
8. **Google Play Console**: update the privacy policy URL (`/privacy`) and the account-deletion URL in the store listing and Data safety form.
9. **Afterwards**, once users have moved and the new app version is out:
   - In `vercel.json`, redirect every path to the new domain.
   - Later, delete the Vercel project and its environment variables, and disconnect the Vercel GitHub app from the repository.
   - Remove the old origin from `BASE_ORIGINS` and the extension manifest.
10. **Not affected**:
    - Webhooks: Cardstead has none.
    - Shopify stock checks: the shops answer `Access-Control-Allow-Origin: *` (sampled 23 November 2026). Run `CARDSTEAD_ORIGIN=https://cardstead.kcaron.top python tools/probe-shopify-shops.py` to recheck all of them.
    - The tcgcsv, Bank of Canada and TCGdex calls.
    - Supabase's database and its row-level security.

## Rollback

DNS is the only switch. Removing the custom domain, or pointing `cardstead.kcaron.top` elsewhere, sends nobody back to Vercel by itself. Vercel keeps serving `pokeflip-studio.vercel.app` throughout, so "rollback" means telling users to keep using the old address until a fix ships.
