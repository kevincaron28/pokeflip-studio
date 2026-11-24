# Shop checker on the owner's Windows PC

**Why a home PC.** Shopify refuses most requests from cloud and datacenter addresses:
- Supabase (3.99.206.188, AWS ca-central-1): 95 of 99 shops answered 429, one shop at a time, 4 seconds apart, a single
  small request each (24 November 2026).
- The Oracle VM (151.145.59.214): 429 too, with our named User-Agent and with plain curl.
- The owner's home connection: the same requests answer 200.

We do not work around this (no proxies, no address rotation, no disguised browsers). A home PC is an ordinary home
address, used openly with the same named User-Agent and the same polite rules. Only if the owner agrees.

**What it means for the owner.**
- Alerts only arrive while the PC is on and he is signed in.
- About 45 shop requests every 2 minutes leave his home connection, about 1 MB of data, with one light Node process for
  a few seconds.
- If Shopify ever throttles his home address, he may see slower Shopify shop pages himself for a while. The checker backs
  off from any shop that refuses (30 minutes, then up to 6 hours).

| File | What |
| --- | --- |
| `deploy/shop-checker/windows/install-windows.ps1` | One-time setup, no admin needed. Copies only the checker files into `%LOCALAPPDATA%\Cardstead\checker\app`, creates `checker.env` readable by his Windows account only, and registers the task **switched off**. Safe to run again |
| `deploy/shop-checker/windows/run-windows.mjs` | One pass, started by the task. Updates its code from `main` at most once an hour (installed copy only), skips if a pass is still running, and writes to `logs\checker.log` (1 MB cap, one older file kept) |
| `deploy/shop-checker/windows/uninstall-windows.ps1` | Removes the task. `-RemoveFiles` also deletes the code, logs and settings |
| `%LOCALAPPDATA%\Cardstead\checker\checker.env` | Supabase URL and public key, **`CHECKER_KEY` (the only secret)**, pacing (2 shops at a time, 0.5 s apart at home) |

The task:
- Runs `conhost.exe --headless node run-windows.mjs`, so no window appears.
- Runs every 2 minutes, never two at once, and stops a pass after 2 minutes.
- Runs only while the PC is on and he is signed in, with normal rights.
- Has low priority and never wakes the PC.
- Option `-RunWhileSignedOut` also runs it when nobody is signed in. That needs an administrator PowerShell; no password
  is stored.

## Install (only if the owner agrees)

1. Requirements: Node.js 22 or later and Git. Check with `node -v` and `git --version`.
2. Download and run the installer in a normal PowerShell window:
   ```powershell
   Invoke-WebRequest https://raw.githubusercontent.com/kevincaron28/pokeflip-studio/main/deploy/shop-checker/windows/install-windows.ps1 -OutFile $env:TEMP\cardstead-install.ps1
   powershell -ExecutionPolicy Bypass -File $env:TEMP\cardstead-install.ps1
   ```
   It ends with "CHECKER_KEY: missing. The task is OFF."
3. **The key (one secret line).**
   - Supabase → SQL Editor: run `migrations/006-checker-key.sql` once (if not done), then
     `select public.checker_new_key('owner-pc');`. It shows a key once.
   - `notepad "$env:LOCALAPPDATA\Cardstead\checker\checker.env"`: paste the key right after `CHECKER_KEY=` (no spaces,
     no quotes), save and close.
   - Do not paste it anywhere else. Supabase keeps only its hash; a lost key is replaced by making a new one.
4. **Pause the Supabase cron job `shop-checker-tick`** (do not delete it): Integrations → Cron → Active off, or
   `select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'shop-checker-tick'), active := false);`
   Then do one pass by hand and read the log (the installer prints the exact command):
   ```powershell
   node "$env:LOCALAPPDATA\Cardstead\checker\app\deploy\shop-checker\windows\run-windows.mjs"
   Get-Content "$env:LOCALAPPDATA\Cardstead\checker\logs\checker.log" -Tail 20
   ```
   The last line is a summary such as `{"shops":45,"unchanged":0,"read":45,"refused":0,"failed":0,"events":0}`. The
   first read of each shop records what is there without alerting.
5. Turn the task on: `Enable-ScheduledTask -TaskName 'Cardstead shop checker'`.

## Day to day

| Check | Command (PowerShell) |
| --- | --- |
| Last passes | `Get-Content "$env:LOCALAPPDATA\Cardstead\checker\logs\checker.log" -Tail 30` |
| Task state and last result | `Get-ScheduledTaskInfo -TaskName 'Cardstead shop checker'` |
| Pause / resume | `Disable-ScheduledTask` / `Enable-ScheduledTask -TaskName 'Cardstead shop checker'` |
| Remove | `powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\Cardstead\checker\app\deploy\shop-checker\windows\uninstall-windows.ps1" -RemoveFiles`, then in Supabase `delete from public.checker_keys where label = 'owner-pc';` and set `shop-checker-tick` active again if wanted |

Troubleshooting:
- **"checker key not accepted"**: make a new key (step 3).
- **Many `back off` lines**: set `CHECKER_CONCURRENCY=1` and `CHECKER_GAP_MS=2000` in `checker.env`.

## Sanctioned routes (researched 24 November 2026)

- **Shop-granted crawler access (the clean route, shop by shop).**
  - A Shopify merchant can create a signature for a crawler in their own admin: **Online Store → Preferences → Crawler
    access**. They name it, pick a domain and choose an expiry of up to 3 months. Our checker would send its three headers
    (`Signature-Agent`, `Signature-Input`, `Signature`).
  - Shopify describes it for merchants' first- or third-party tools such as audits and data analysis. It would let a
    willing shop be read from the server, with its permission.
  - Cost: asking each shop, and a new signature from them every 3 months. Not built yet. It needs a small per-shop
    secret store and the headers in `shop-checker.mjs`.
  - Sources: [Shopify Help, crawling your store](https://help.shopify.com/en/manual/promoting-marketing/seo/crawling-your-store),
    [changelog: crawler access keys](https://changelog.shopify.com/posts/authorize-custom-crawlers-and-tools-with-new-crawler-access-keys).
- **Registering as a third-party signed bot (Web Bot Auth, RFC 9421 signatures).**
  - Shopify asks bots to identify themselves this way. Signed traffic gets higher limits than anonymous traffic.
  - Several developers report 429s from cloud addresses even when signed, including a TCG price crawler and one on Oracle
    Cloud (OCI). Not a reliable fix today.
  - Sources: [changelog: bots should identify via Web Bot Auth](https://shopify.dev/changelog/posts/bots-and-agents-should-identify-themselves-via-web-bot-auth),
    [Storefront API rate limits](https://shopify.dev/docs/api/storefront#rate-limits),
    [forum: signed crawler 429 from OCI](https://community.shopify.dev/t/third-party-web-bot-auth-crawler-receives-immediate-429s-from-oci-but-succeeds-residentially/36440).
- **Shopify Global Catalog (agents).**
  - Cross-merchant product search with availability and price, and no API key (an agent profile).
  - **Its terms forbid this use**: no "systematic or automated data collection", no "inventory synchronization", and
    availability may be cached for 10 minutes at most. It would fit an on-demand "check stock now" button a member
    presses, not a background monitor.
  - Source: [About Catalogs](https://shopify.dev/docs/agents/catalog).
- **Storefront API without a token.** Products and availability are readable, but "bots and crawlers are limited, most
  strictly when unsigned", and the limit is per address. Same problem from the cloud.
  Source: [Storefront API rate limits](https://shopify.dev/docs/api/storefront#rate-limits).
- **Retailer emails** (back-in-stock and newsletter sign-ups into the drops email worker): sanctioned by every shop that
  offers them. Waiting on the owner's Cloudflare sign-in.
