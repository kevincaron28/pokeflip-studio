# Production access application (Cardstead)

Package `top.kcaron.cardstudio`, Play Console app 4973209881069245345. Prepared 26 Nov 2026. **The owner submits the application.**

## When

- Closed testing (Alpha) on 26 Nov 2026: the Dashboard says **12 testers opted in for 2 days continuously**. Google requires 12 testers for 14 days in a row.
- Earliest date to apply: **8 Dec 2026**, if the count never drops under 12. Apply when **Dashboard → Apply for production** becomes clickable.
- With exactly 12 testers, one person leaving puts the requirement at risk. A few extra testers are a cheap buffer.
- Google says its review usually takes 7 days or less.

## Release in the test

| Version | Closed testing |
|---|---|
| 4.3.2 (40302) | Released 23 Nov 2026 |
| 4.4.0 (40400) | Approved and available to testers 26 Nov 2026 |
| 4.4.1 (40401) | Sent for review 26 Nov 2026 (on internal testing since 26 Nov) |
| 4.6.0 (40600) | On internal testing 26 Nov 2026; sent for closed testing review the same day |

4.6.0 renames My cards to Watchlist and adds set checklists, search across every listed set, recent restocks and typical asking prices at Canadian shops, optional price alerts, account deletion in the app and price fixes. 4.5.0 was never uploaded. 4.4.1 added pictures and fixed eBay alerts and the notification permission.

Play Console → Monitor and improve → Ratings and reviews → **Testing feedback** showed no feedback on 26 Nov 2026.

## Before you apply (during the 14 days)

Google asks about tester use and feedback, so collect them now.

1. Once 4.6.0 is approved, send testers a short task list: search a card, open its card page, add it to the Watchlist with a target price, tick cards in a set, open Recent restocks, add a drop watch, and turn on drop alerts if they want. Ask them to reply by email or Play's private feedback.
2. Write down each reply with its date, and what you changed because of it.
3. Test on your own Android phone with the Play build (table below).
4. Keep every `[bracket]` below out of the form: replace it with a fact or delete the sentence. Do not describe feedback or testing that did not happen.

| Check on the phone | Status on 26 Nov 2026 |
|---|---|
| Install from Play, open, back button | Not recorded as verified |
| Offline launch | Not recorded as verified |
| Sign in by email (code or link), as someone who is **not** on the Supabase project team | Not verified. Supabase's built-in sender only mails the project team, 2 an hour, unless custom SMTP is set up (`docs/AUTH-EMAIL-SMTP.md`) |
| Cloud backup between two devices | Not verified |
| Notification for a price target and a restock watch | Not verified |
| App push for drop alerts | Not verified. The 4.4.1 bundle has app push switched on (`fcm-config.js`), and the 4.6.0 build log was reported to say "App push on". The Firebase server secret and delivery to a phone are unchecked |
| Price alerts with the app closed | Not verified. The site offers the choice (`priceAlerts` true on 26 Nov); the daily job and delivery are unchecked |
| Delete my account, on a phone | Not recorded as verified |
| Shop checker feeding drop alerts and restocks | Installed and running on the owner's PC, but on 26 Nov most requests were refused (429). The Drops page said "Shop checks have not run yet" above recent sightings, and no product had a typical price |
| Security review of the cloud save function | Open (`RELEASE-STATUS.md`) |

## The answers

The question wording and the 300-character limit for part 1 were read from the console's preview on 26 Nov 2026. Parts 2 and 3 follow Google's [help article](https://support.google.com/googleplay/android-developer/answer/14151465); check the limit in the form. Each draft below is under 300 characters before you fill the brackets; check the length again after.

### 1. About your closed test

**How did you recruit users for your closed test?**

The closed track's tester list is the Google Group `testers-community@googlegroups.com`. Confirm how you joined it (paid or test exchange) and whether you invited anyone yourself.

<!-- answer:recruit -->
I recruited testers through the Testers Community Google Group, which connects developers with Android testers. [Paid service / free test exchange.] [I also invited N friends or local collectors.]
<!-- /answer -->

**How easy was it to recruit testers?** (Very difficult … Very easy) Your own experience: pick it yourself.

**Describe the engagement you received from testers** (features used, and how that compares with real users).

<!-- answer:engagement -->
[N] testers used the app over 14 days. They tried [price search, card pages with eBay.ca prices, Watchlist targets, set checklists, restocks, alerts]. Not used: [features]. Real collectors would likely [difference, e.g. return more often around releases].
<!-- /answer -->

**Summarize the feedback you received, and how you collected it.**

<!-- answer:feedback -->
Collected by [email / Play private feedback / group messages]. Main points: [1], [2], [3]. [N] problems reported; fixed: [which]. Still open: [which].
<!-- /answer -->

### 2. About your app

**Who is the intended audience?**

<!-- answer:audience -->
Teen and adult trading card collectors in Canada, especially beginners sorting French and English cards who want to know a fair price in Canadian dollars before they buy or sell. Not directed at children under 13.
<!-- /answer -->

**How does your app provide value to users?**

<!-- answer:value -->
It shows what a card or sealed product is worth in CA$, with sources, date and confidence, plus eBay.ca asking prices clearly marked as asking prices. Users set price targets, tick off sets, and follow Canadian releases and restocks. English and French, no account needed.
<!-- /answer -->

**Expected installs in the first year:** suggested: the lowest range offered. It is a new, niche app with no advertising.

### 3. Your production readiness

**What changes did you make based on what you learned in your closed test?**

4.4.0, 4.4.1 and 4.6.0 replaced 4.3.2 during the test. Those changes came from your own use of the app and your plans (`docs/plans/SIMPLIFY_2026-11.md`), not from tester reports; add tester-driven fixes when there are some.

<!-- answer:changes -->
From my own testing I cut to four tabs, removed the scanner and portfolio, added a watchlist with price targets, set checklists, eBay.ca asking prices and Canadian restocks, and fixed prices and alerts. [Tester-driven changes.]
<!-- /answer -->

**How did you decide that your app is ready for production?**

<!-- answer:ready -->
Automated unit and browser tests run on each change, plus checks of the live site. 12 testers had the app for [14] days. On my Android phone I checked [install, sign-in, notifications, offline use] and fixed [issues]. No blocking problem is open.
<!-- /answer -->

Use the last answer only when it is true: run the phone checks first, and fix or list anything that blocks.

## What changed since 4.3.2

- Four tabs: Prices, Drops, Watchlist, Settings.
- Prices: CA$ value with sources, date and confidence; price history graphs; search across every listed set; set pages that work as checklists, with the cost to complete.
- Live eBay.ca asking prices on card pages, in the Watchlist and in the daily price check.
- Watchlist replaces the portfolio pages: price targets and "under value" alerts.
- Camera scanner removed, with its camera permission.
- Drops: coming releases calendar, recent restocks and typical asking prices at Canadian shops, optional drop alerts and price alerts.
- Page addresses, Back and sharing; sign-in by email code; account deletion and privacy policy in the app.
- Fixes: a raw card opens the raw price, graph labels over CA$1,000, no raw history on graded cards; fuller French.

## Done in Play Console on 26 Nov 2026

Sent for review together and published the same day (7 changes): the 4.4.0 closed release, the store listing ([store-listing.md](store-listing.md)) and Data safety ([data-safety.md](data-safety.md)). Managed publishing is off.

The 4.4.1 closed release was sent for review separately later that day, then the 4.6.0 closed release.

The 4.6.0 store listing (English and French (Canada), new screenshots) was saved as a draft and **not** sent for review: see [store-listing.md](store-listing.md).

Checked, not changed: content rating (IARC, 23 Nov: Everyone / PEGI 3), privacy policy address `https://pokeflip-studio.vercel.app/privacy.html`.

## Known problems worth fixing before production

- Recent restocks says "Shop checks have not run yet" while listing recent sightings. Likely cause: `migrations/008-restock-feed.sql` dates the last check only from shops whose latest answer was 200 or 304, and the checker was being refused.
- Most shop requests were refused (429) on 26 Nov, so restocks are thin and no product reached the three shops needed for a typical price.
- Amazon links are untagged on the live site (`AMAZON_ASSOCIATES_TAG` not set), so no disclosure shows. If you set it, check Play's Ads declaration again.
