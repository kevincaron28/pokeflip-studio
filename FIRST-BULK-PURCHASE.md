# PokéFlip — First bulk purchase field guide (Québec)

**Before paying:** This is a beginner resale operation, not guaranteed investment income. A live app or camera match does not establish card value. Keep your first test lot small and insist on seeing the actual cards.

## In the store or at pickup
1. Ask for clear photos, card count, language (FR/EN), and whether holographic cards, rares, and valuable cards were removed.
2. Inspect a random handful of cards **front and back** for creases, edge wear, dirt, moisture, and counterfeit indicators. If uncertain, do not price as Near Mint.
3. Confirm the asking price and taxes. Use **Buy or Pass** with a conservative sell-through estimate and selling fees. Do not assume every card sells individually.
4. If the lot is predominantly common/uncommon bulk, judge it by bulk liquidation value, not sum of speculative single-card listings.
5. Record seller, amount paid, date, and card count. Keep a receipt or screenshot for bookkeeping.

## After purchase: fastest safe sorting
- Create a new **Purchase Lot** immediately. Use the total amount paid (including acquisition expenses) and take a group photo.
- Put uncertain foils, full arts, old-looking cards, and unusual variants in **A — Protect**, sleeved; don't price them yet.
- Scan promising cards; verify **card name + set + collector number + artwork + language + finish** before accepting a result.
- If scan is ambiguous, choose **R — Review**, not a guessed printing. A similar illustration from a different expansion can have a very different price.
- Keep unsorted commons separated by language; enter them using **Bulk Entry** as a counted lot. Scanning every low-value common is not required.
- Use eBay *sold* comparisons; match edition, finish, language, grade/condition and currency. Research accepted offers carefully; asking prices aren't sales.
- Do not pay for professional grading based on one phone photo. Inspect front/back with raking light, and compare likely grading proceeds against shipping, fees and turnaround.

## Data protection
- Export **Settings → Download full JSON backup** after each sorting session.
- Cloud login uses Supabase email authentication; you may need to allow the deployed app URL in Supabase Authentication → URL Configuration for magic links to return correctly.
- A new device with existing cloud data must **Download** first; uploads are intentionally rejected until you have the correct revision.
- Never clear browser storage while unsynced data remains. Photos aren't included in JSON backups.

## Current limits (November 2026 release candidate)
- Scanner: assisted OCR and visual set-symbol ranking, **not** independently validated exact-card auto-identification on hundreds of real cards.
- Grading: screening workflow, **not** a predicted PSA grade.
- Prices: research and manually recorded verified eBay sold comparisons, **not** live automatic sold-sale API feed.
- Restocks: imported or manually logged provider alerts, **not** unattended retailer monitoring.
- Hosting: Vercel project exists, but this archive has not been deployed and acceptance-tested.
