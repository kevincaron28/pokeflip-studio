# PokéFlip Studio v3.1 — verified status (November 21, 2026)

## Verified
- 50 Node automated tests pass, including exact set/collector-number identification and French accent handling.
- A Chromium **embedded** mobile-width UI test passes navigation across all tabs, purchase-lot creation, bulk inventory of 100 French cards and dashboard calculations. It uses a substitute in-memory browser storage because navigation is blocked in the runtime.
- Dedicated Canada Central Supabase project exists, with RLS and a per-owner, revision-controlled snapshot RPC. The live privilege audit confirmed no anonymous inserts and no direct user updates.
- Vercel project `pokeflip-studio` exists and its team connection is authorized.

## Still a release gate — NOT verified
- No current Vercel deployment exists. Use DEPLOY-WINDOWS.ps1 on a linked computer and verify the deployment URL.
- Configure your deployed URL under Supabase Authentication URL Configuration (Site URL / redirect allow list) to support passwordless email links. Verify OTP and link sign-ins on your real email account.
- Verify upload -> download from a **second** device, and conflict handling. Keep separate backups.
- Validate camera focus, OCR, set symbol accuracy, variants, condition and grading screen on labeled real French/English cards, including deliberate ambiguous printings. No performance or grading-accuracy claims are warranted yet.
- Automated eBay sold-item research requires Marketplace Insights approval or other legitimately licensed access; do not scrape protected data or treat listed asks as sales.
- Continuous restock monitoring requires authorized supplier feeds/email notifications and server-side scheduling. Importing third-party notifications is supported; continuous unattended monitoring is NOT.
- The Supabase advisor flags the intentionally user-callable SECURITY DEFINER atomic RPC. It derives the owner from auth.uid(), uses fixed SQL and validated payload, but deserves independent security review before multi-user release.

## Deploy from Windows (your PC)
1. Extract the complete ZIP, including hidden `.vercel/project.json`.
2. Open PowerShell in the extracted folder. Install Node.js LTS if `npx` is unavailable.
3. Run `./DEPLOY-WINDOWS.ps1` (or `npx vercel@latest deploy --prod` manually). Complete Vercel login if prompted.
4. Confirm the target project before publishing; do not paste authentication tokens into chats.
5. Visit the deployment URL, inspect mobile layout, create a throwaway test lot, export a backup, test email login and sync. Remove sample data from the app afterward.

## Before buying hundreds of cards
- Prioritize storing lots, photos, and prices safely, but **do not rely on automated card identification or preliminary grading for purchase decisions** before the labeled-photo test set is evaluated.
- Keep expensive or ambiguous cards in Review until set code, collector number, foil variant and condition are confirmed.
- Use eBay actual sold research for comparisons and include all shipping, fees and packaging expenses.