# Finish-line audit — PokéFlip Studio v4.2 (2026-11-22)

Scope: audit of `main@35c7178`, issues #1–#6, security review, competitor research, clear bug fixes (branch `audit/finish-line`).
Nothing was deployed, no Supabase/eBay/Vercel setting or credential was touched. Evidence labels: **[ran]** = I executed it, **[read]** = code review only, **[not tested]** = could not be verified from this machine.

## 1. What works (evidence)

| Area | Status | Evidence |
|---|---|---|
| Node tests | 74/74 pass at baseline, 76/76 on this branch | **[ran]** `npm run check` (Node v24) |
| Chromium acceptance (6 scripts: theme-layout, mobile-scanner, continuous-camera, browser_embedded, cloud_autosave_browser, live-browser) | all pass | **[ran]** Playwright 1.56 / Chromium 1194 on Windows. Needed `PYTHONUTF8=1` and a Chromium path fix (see bugs B5/B6). `browser_embedded` timed out once on a 1.8 s click and passed on 3 reruns: mild flake under load |
| Hosted site | HTTP 200, `index.html`, `app.js`, `sw.js` byte-identical to `main` (CR-normalised md5); security headers present (nosniff, XFO DENY, HSTS, COOP, Permissions-Policy) | **[ran]** curl + `live-browser.py` against https://pokeflip-studio.vercel.app |
| Live scanner single + stack mode | Gate logic, queueing, target stop, no same-card repeats verified with a **fake** video stream | **[ran]** `continuous-camera.py`. Not a real camera (gate #2/Pixel) |
| Card lookup (TCGdex) | API reachable (`fr/cards?name=Pikachu` returns results); bilingual fallback and exact-set protection covered by unit tests | **[ran]** curl + node tests |
| Identity / variant / condition guards, ledger, bulk intake, 1,200-entry pagination, CSV export, backup validation | pass | **[ran]** tests |
| Pricing: TCGdex market reference (USD/EUR, age/stale flags), eBay comps (3 distinct CAD sold comps needed, dedup by item id, shipping separated), fee calculator, deal calculator | logic sound; honest labelling | **[read]** + node tests |
| Cloud sync (opt-in, revision CAS, autosave stops on conflict) | passes with **mocked** Supabase | **[ran]** `cloud_autosave_browser.py`. Live account: untested (gate #1) |
| Alerts / restock / sealed guide | manual-entry watchlists only; clearly not a live monitor | **[read]** |
| PWA | manifest valid, SW network-first for same-origin shell, personal data not cached (tested) | **[read]**; install/offline on Pixel **[not tested]** |
| Secrets | none in repo: only the Supabase URL + `sb_publishable_…` key (public by design). `.gitignore` OK | **[read]** grep of tree |

I did **not** hand-drive every screen on a real phone; interactive coverage is what the automated tests exercise plus the code review above.

## 2. Bugs found

| # | Sev | Bug | Repro / impact | Status |
|---|---|---|---|---|
| B1 | **High (security/integrity)** | `pokeflip_private.save_snapshot` validation is not NULL-safe: `next_payload->>'schema' <> '5'` is NULL when the key is missing, so a long `OR` chain evaluates to NULL and `if` does not raise. | Authenticated user calls RPC `pokeflip_save_snapshot(0,'{}')` → accepted. Server-side schema validation can be skipped (own row only; 4 MB cap still applies). A bad snapshot then makes the app's own download say "Unsupported cloud backup". | **Fixed in repo** (`cloud-schema.sql`, `migrations/001-…sql`, test). **Needs owner to apply the migration in Supabase** — I did not touch the project. Reading from the live DB to confirm the deployed function matches the file was **not possible** |
| B2 | High on target device | Restock alert uses `new Notification(...)`. Android Chrome throws "Illegal constructor" — the Pixel is exactly that case. | Grant notification permission, record an in-stock check under the price ceiling → exception caught by the form handler, so the user sees an error message though the check was saved. | **Fixed** (service-worker `showNotification`, safe fallback). Regression test fails on old code, passes now. Real Pixel notification still **[not tested]** |
| B3 | Medium (rule 5 of AGENTS.md) | CSV import silently turns any blank/unknown `language` into **French**. | Import a row with an empty language column → saved as FR, category kept (e.g. "single"). Breaks "unknown goes to Review". Invalid rows were also dropped silently. | **Fixed**: unknown language → Review/unsorted; FR/EN synonyms accepted; toast reports Review and skipped counts. Regression test added |
| B4 | Low | Portfolio chart axis dates use `new Date('YYYY-MM-DD')` (UTC) → shows the previous day in Québec. | View chart with ≥2 snapshots in UTC−5 | **Fixed** |
| B5 | Low (dev) | `browser_acceptance.py`, `browser_embedded.py`, `cloud_autosave_browser.py` hard-code `/usr/bin/chromium`; two read files without `encoding`. AGENTS.md's required command fails on Windows. | Run on Windows | **Fixed** (`CHROMIUM_PATH` env optional, utf-8) |
| B6 | Low | `storage` event handler disables every submit button permanently after another tab writes data; user must reload (message says so, but nothing re-enables). | Two tabs | Not fixed (design choice; proposal P9) |
| B7 | Low | `autosave` is not rescheduled if a change lands while another cloud op is `busy`; it waits for the next save event. | Edit during Upload | Not fixed |
| B8 | Low | `docs/ROADMAP.md`/`RELEASE-STATUS.md` still describe v3.5; "Canada Central" typo ("3Canada Central3"). | — | Not fixed (owner updates after gates close) |

## 3. Security review

Reviewed `cloud-schema.sql`, `cloud-sync.js`, `vercel.json`, `index.html`.

**Sound:** RLS enabled; table grants are `SELECT` only for `authenticated` with an owner policy; `anon` has nothing; no INSERT/UPDATE policies; owner taken from `auth.uid()` inside the writer; compare-and-swap on `revision`; `search_path=''` with schema-qualified names; the definer function lives in a schema not exposed through the Data API; public wrapper is `SECURITY INVOKER` (so it adds no privilege). The "privileged RPC" worry in RELEASE-STATUS reduces to: the writer is small, has no dynamic SQL and no client-supplied owner. **With B1 fixed I consider the design acceptable for multi-user**, subject to a live two-account test (gate #1/#6), which I could not do.

**Open items (not fixed here):**
1. *No CSP.* A Supabase session token lives in `localStorage` and the page loads two CDN scripts. XSS or a CDN compromise would expose it. Mitigation added here: both CDN scripts are now **pinned to exact versions with SRI** (`supabase-js 2.119.2`, `tesseract.js 6.0.1`; hashes computed from the exact bytes currently served, verified to load in Chromium). Still recommended: a `Content-Security-Policy` header (`script-src 'self' cdn.jsdelivr.net`, `connect-src` Supabase + `api.tcgdex.net` + Tesseract language CDN, `img-src` TCGdex assets + `blob:` + `data:`). Needs a real-device test because Tesseract spawns workers/WASM.
2. *Open sign-up* (`disable_signup:false`, read from the public `/auth/v1/settings`) with `shouldCreateUser:true`: anyone can create accounts and store up to 4 MB each. Add Supabase Auth rate limits / CAPTCHA and consider a per-user quota; fine for a pilot.
3. *Built-in Supabase email is rate-limited* (a few messages/hour on the default sender). This will hit gate #1 testing and any real user onboarding; a custom SMTP sender is the usual fix (owner/account action).
4. Redirect allowlist must contain `https://pokeflip-studio.vercel.app` (and `http://localhost:*` only for dev) — owner-side, unverified.
5. Tesseract language data is fetched at runtime from a CDN: OCR does not work offline and is outside SRI.
6. `emailRedirectTo` uses `location.origin + pathname`; a preview-deployment URL would be rejected unless allowlisted — correct behaviour, just note it.

## 4. Release gates (#1–#6)

| Gate | State | What closes it | Owner device / account? |
|---|---|---|---|
| **#1** Live email OTP/magic link + two-device sync | Open. Mock tests pass; live untested. Public settings show email enabled, autoconfirm off, signup open | (a) Supabase Auth: Site URL + redirect allowlist, ideally custom SMTP; (b) apply migration 001; (c) test script: sign in on Pixel + desktop, first upload, download on 2nd device, rollback, deliberate conflict; capture redacted evidence | **Yes**: Supabase dashboard (account) + Pixel + a real inbox |
| **#2** Scanner accuracy benchmark | Open. No labelled set exists; pipeline is Tesseract OCR + heuristics + manual confirm (symbol matcher is an aid) | Photograph ≥100 real FR/EN cards (front, bottom strip, incl. reverse/holo, reprints), label them, add a repeatable harness (`tests/benchmark/`) reporting top-1 exact printing, false-positive rate, sec/card. I can build the harness and ground truth template; photos must come from the owner | **Yes**: the cards + Pixel camera |
| **#3** Authorized eBay sold feed | Open, blocked externally. Manual Product Research comps are the compliant path and work | Apply to eBay Marketplace Insights (restricted; not guaranteed) or keep manual comps; do **not** scrape | **Yes**: eBay developer account |
| **#4** Restock monitoring | Open. App is manual-entry only (honest). The README-listed providers have no sanctioned API | Choose consented feeds (retailer email alerts parsed via a forwarding address; official provider APIs if any) + a scheduler (Vercel cron/Supabase Edge) + Web Push (needs VAPID keys → owner decision). Don't scrape Discord | **Yes**: accounts, push keys, decision |
| **#5** Auto deploy/monitoring | Partially OK: manual SHA deploys work; CI workflow exists incl. a deployed-site smoke job. Push-deploy not authorised by owner's rule | Install Vercel GitHub integration (owner choice; current policy says manual) + error monitoring (none) | Yes (Vercel account) |
| **#6** Security/backup review | This audit covers the code review and finds B1. Remaining: live two-account cross-read test, restore drill, retention policy | Run with two test accounts after gate #1; write restore drill | Yes (two inboxes) |

CI: workflow `ci.yml` runs Node checks + 6 Chromium scripts + deployed-site smoke. I added no new workflow. See the PR for its run status.

## 5. Research: what collectors value and how to improve scan accuracy

Sources: competitor store listings and reviews (TCGplayer, Collectr, DittoDex, PokeScope, Snapdex), TCGplayer's scanning tips, and open-source scanner write-ups (PokVault Rev paper, jslok/card-scanner, Roboflow card-inventory tutorial). Vendor accuracy claims (82–96 %) come from marketing blogs without methods: treat as unverified. Useful consensus:
- Collectors value: **fast bulk/binder scanning**, correct **variant** (reverse vs holo is up to 10× price), portfolio value over time, price from several sources with date, grading/condition notes, multi-card/sleeve scanning, wishlists and set-completion tracking, CSV/backup export, offline use.
- Accuracy practice: art-embedding or perceptual-hash **retrieval of candidates** then confirm with collector number + set symbol/total; plain background, crop and magnify the card before OCR; hash collisions need long/multi-hash; non-English cards are only matched by art if an identical English card exists, so the language must be read from the card text, not art.
- This app already has the right *philosophy* (never auto-confirm, cross-check number/total/set/finish). Its weak point is the *recognition front-end*: whole-image Tesseract with fixed 70 %-down crop, no card detection/perspective correction, French accents/names rely on OCR quality.

## 6. Ranked improvement proposals

| Rank | Proposal | Effort | Why |
|---|---|---|---|
| 1 | **Scanner benchmark harness + labelled set** (gate #2) | M (harness 1 d; owner photographs 100+ cards ~2 h) | Required before any accuracy claim; turns tuning into measurement |
| 2 | **Card detection + perspective crop + bottom-strip ROI** before OCR (canvas edge/contour, or OpenCV.js/ONNX), fixed to the card's number/set strip, name header; retry with contrast boost | M–L | Biggest likely accuracy gain on Pixel; also improves stack mode |
| 3 | **Candidate re-ranking by image similarity**: compare the photo with TCGdex artwork (pHash/dHash multi-hash, later a small on-device embedding) to rank the existing lookup results; keep manual confirm | M–L | Resolves same-name/different-set; uses existing `symbol-match` ideas |
| 4 | **Close the cloud gates** (#1/#6): auth redirect/SMTP, apply migration 001, scripted two-device test, restore drill, CSP | S–M (mostly owner steps) | Needed for "final version" with a trustworthy multi-device story |
| 5 | **Real Pixel QA pass**: camera permission, stack mode stability, PWA install/offline, notification via SW, bottom-dock ergonomics | S (owner + 1 h) | Camera/notification behaviour cannot be validated in CI |
| 6 | Web Push restock alerts with consented feeds (gate #4) | L | Largest user-visible feature after scanning; blocked on provider/push-key decisions |
| 7 | Streamlined bulk workflow: batch "confirm all high-confidence," keyboard/volume-key capture, undo last, per-lot progress | M | Matches the owner's "hundreds of cards" job |
| 8 | Self-host Tesseract worker/core/lang data and cache in SW (offline OCR, no CDN at runtime) | S–M | Offline + supply-chain |
| 9 | French UI localisation + accessibility review; replace the storage-event "disable all submits" with a non-blocking banner | M | Québec user base |
| 10 | Pricing UX: CAD conversion with visible FX rate/date as an *opt-in* context line; set completion; price history per card | M | Collector expectation; keep "never silent conversion" rule |

## 7. Decisions needed from the owner

1. **Apply `migrations/001-null-safe-snapshot-validation.sql`** to the Supabase project (or authorise a session to do so) — yes/no.
2. Supabase Auth: confirm Site URL/redirect list; approve custom SMTP (email rate limit) and CAPTCHA/rate-limits on open sign-up.
3. Scanner direction: approve proposals 2–3 (in-browser detection + hash re-rank) vs keeping OCR-only; and supply the benchmark photos.
4. Restock: which feeds (if any) are acceptable; approve Web Push (VAPID keys) and a scheduler.
5. eBay: pursue Marketplace Insights application or stay with manual comps.
6. Vercel: keep manual SHA deploys or authorise the Git integration.
7. Approve adding a CSP header after one device test.

**Owner device/accounts needed:** Pixel (camera, PWA install, notifications, OTP email), the physical cards for the benchmark, Supabase dashboard access, Vercel dashboard, eBay developer account.
