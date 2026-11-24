# Cardstead Drops: the Discord server and bot

Plan and comparison with other alert servers: `docs/research/discord-alerts-plan-2026-11-24.html` (owner approved all eight decisions on 24 Nov 2026).

## What is built (this branch)

| Piece | File |
|---|---|
| Alert logic: routing, one ping per restock with a 30-minute cooldown, bilingual alert card, CA$ verdict, marketplace detection, Amazon rules, member reports, trusted reporters, speed log, `/price`, DM matching | `supabase/functions/_shared/discord-core.mjs` |
| Orchestration: publishing, buttons, slash commands, one-time server setup | `supabase/functions/_shared/discord-service.mjs` |
| Discord REST client (honours rate limits) and signature check | `supabase/functions/_shared/discord-api.mjs` |
| Database access (service role, inside Supabase only) | `supabase/functions/_shared/discord-store.mjs` |
| Slash commands and buttons (Discord calls this) | `supabase/functions/discord-interactions/index.ts` |
| Scheduled work: post new drops every minute, expire reports, weekly speed log, setup | `supabase/functions/discord-publisher/index.ts` |
| Tables and functions, RLS on everywhere | `migrations/002-discord-drops.sql` |
| Settings → Discord alerts (link a Cardstead account for opt-in DMs) | `discord-link.js`, `index.html` |
| Tests | `tests/discord-bot.test.cjs` |

### How alerts reach Discord

The alert pipeline (shop checker, retailer emails, Amazon API later) inserts confirmed sightings into `public.drop_events`. Every minute `discord-publisher` reads unprocessed rows, decides post / edit / skip, posts to the right channel, stores the message in `discord_posts`, and writes the outcome back to the event (`processed_at`, `discord_outcome`). Confirmed member reports are inserted into the same table, so they follow the same rules.

`drop_events` columns (contract with the pipeline): `product_key, product_name, product_lang (EN|FR|JP), product_kind (booster_box|etb|etb_pc|pack|bundle|blister|build_battle|collection|tin|other; never cases), product_upc, matched_by (barcode|title; title = Medium at most), event_key (store_key|product_key|in_stock|UTC date-hour, unique), store_key, store_name, chain_key (pokemon-center|walmart|bestbuy-ebgames|costco|amazon-ca|indigo-mastermind|pharmacies-grocery, null for card shops), region (qc-montreal|qc-quebec-regions|on-gta|on-ottawa-other|bc|prairies|atlantic|online-canada), city, url (https), price_cad, msrp_cad, seller (store|marketplace), in_stock, limit_per_order, source (shop_check|retailer_email|amazon_api|member_report), confidence (high|medium|low), first_seen_at, market_cad, market_source, market_as_of, image_url, cardstead_url`. Send a row with `in_stock = false` when a product sells out so the alert is edited to "Sold out".

Rules the bot applies: low confidence is never posted; a product at a store pings once when it goes from sold out (or unseen) to in stock, never twice within 30 minutes, and later sightings edit the same message; price above 1.3 × MSRP or a marketplace seller posts without a ping as "Marketplace price, not a restock"; Amazon prices show only when they came from Amazon's API and are less than 24 hours old; two "Wasn't there" taps mark an alert stale.

### Pings

Region channels are visible only to members with that region's role, and chain channels only to members with that store's role. The bot pings the product role (ETB, Booster boxes, …). Discord only notifies people who can see the channel, so a ping reaches members who picked both the region (or store) and the product.

## Owner steps (in order)

1. **Read Discord's Developer Policy** once before launch: https://support-dev.discord.com/hc/en-us/articles/8562894815383-Discord-Developer-Policy (our automated check could not open it).
2. **Create the bot application** at https://discord.com/developers/applications → New Application → name `Cardstead Drops` → tick the Developer Terms box → Create. Then:
   - General Information: copy **Application ID** and **Public Key** (neither is secret). Set Privacy Policy URL `https://pokeflip-studio.vercel.app/privacy.html` and Terms of Service URL (same page for now).
   - Bot: turn **Public Bot** off. Leave all three Privileged Gateway Intents off (the bot doesn't need them).
   - Installation → Install Link: Discord Provided Link, Guild Install scopes `bot` and `applications.commands`, permissions integer **309506337840** (Manage Channels, Manage Server, Manage Roles, View Channels, Send Messages, Send Messages in Threads, Create Public Threads, Manage Messages, Embed Links, Attach Files, Read Message History, Mention All Roles). Open the link and add the bot to **Cardstead Drops**. After setup (step 7) you can remove Manage Channels and Manage Server from its role.
3. **Bot token → Supabase, by you only.** Developer Portal → your app → **Bot** → **Reset Token** → Copy. Then open https://supabase.com/dashboard/project/fehvorwdcswhhonavyit/functions/secrets (Supabase → project → **Edge Functions** → **Secrets**) → **Add new secret**: Name `DISCORD_BOT_TOKEN`, Value: paste → **Save**. Don't paste the token anywhere else (chat, repo, email). If it ever leaks, Reset Token and replace the secret.
4. On the same Secrets page add (not secret, but kept together): `DISCORD_APP_ID` = Application ID, `DISCORD_PUBLIC_KEY` = Public Key, `CARDSTEAD_URL` = `https://pokeflip-studio.vercel.app/`. `DISCORD_GUILD_ID` is optional: the bot finds its only server by itself. The Amazon tag is not set here: the bot reads it from the site's `/api/config`, so `AMAZON_ASSOCIATES_TAG` on Vercel stays the one setting (docs/AMAZON-ASSOCIATES.md).
5. **Database:** Supabase → SQL Editor → paste `migrations/002-discord-drops.sql` → Run.
6. **Deploy the two functions** (after this PR is merged): `supabase functions deploy discord-interactions discord-publisher --project-ref fehvorwdcswhhonavyit` (Supabase CLI, signed in as the owner). Then in the Developer Portal → General Information → **Interactions Endpoint URL**: `https://fehvorwdcswhhonavyit.supabase.co/functions/v1/discord-interactions` → Save (Discord tests the URL; it must say saved).
7. **Build the server:** Supabase → Edge Functions → `discord-publisher` → **Test** → role `service_role`, method POST, body `{"task":"setup"}` → Send. It creates the roles, categories, channels (read-only alert channels, hidden region and chain channels), the five slash commands and three AutoMod rules (scam links and phrases, mass mentions, spam). It is safe to run again.
8. **Schedules:** Supabase → Integrations → **Cron** (install it; also run `create extension if not exists pg_net with schema extensions;` once) → Create job ×2, type "Supabase Edge Function", function `discord-publisher`, method POST, timeout 5000 ms, header from **Add header ▾ → Add secret key** (it sends the project's `sb_secret_` key as `apikey`; the function accepts it), and in the function's Settings turn **Verify JWT** off:
   - `discord-drops-tick`, schedule `* * * * *`, body `{"task":"tick"}`
   - `discord-speed-log`, schedule `0 13 * * 1` (Monday 8:00 Eastern), body `{"task":"speed-log"}`
9. **In Discord (server settings, as owner):** turn on Community (it asks you to accept Discord's community rules: your call), set Verification Level to Medium, then **Onboarding**: questions "Region / Région" (one role per region), "Stores / Magasins" (chain roles + "Online only"), "Products / Produits" (product roles + eBay deals), "Language / Langue" (Français, English). Give your two moderators the `Moderator` role. Post the rules in `#bienvenue-welcome`.
10. Keep the server private (no invite links) until the pipeline has caught real drops; then create one invite and link it from Cardstead.

## Commands

`/price card:` and `/prix carte:` (TCGplayer and Cardmarket reference prices in CA$ with confidence), `/report` (member report: needs a link or photo and an account 7+ days old; a second member confirms within 30 minutes; trusted reporters post at Medium right away), `/link` (code for Settings → Discord alerts), `/flag` (sends to `#mod-queue`).

## Costs

Free: Discord server, application, AutoMod; Supabase functions and cron within the free tier (about 45,000 publisher calls a month plus interactions, against 500,000 included).
