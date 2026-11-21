# PokéFlip Studio — Agent Instructions

## Mission
Develop a trustworthy Canadian Pokémon TCG collection and resale web application for a beginner sorting hundreds of French and English cards. Never treat asking prices as completed sales or imply scanned condition equals a formal grade.

## Working rules
1. Read `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, and `RELEASE-STATUS.md` before making changes.
2. Run `npm run check` and `python tests/browser_embedded.py` for UI-affecting changes. Document tests that cannot run.
3. Do not commit user inventory exports, `.env`, access tokens, service-role keys, production backups, or personally identifying information.
4. Cloud saves are revision-checked and user-isolated. Never disable RLS or bypass revision conflict checks.
5. Keep French/English language, exact set/number, holo variant, condition, and seller evidence separate. Unknown items go to Review.
6. Do not scrape authenticated eBay sold data or third-party Discord services without permission.
7. Use feature branches and reviewed pull requests. Prefer small changes with regression tests.
8. Never claim production readiness until hosted, device, cloud auth/sync, scanning and security gates are verified.

## Tests
`npm run check` for Node tests; `python tests/browser_embedded.py` requires Playwright and Chromium.

## Environments
Supabase is deployed separately in ca-central-1; publishable URL and key in `cloud-sync.js` are public, no secret credentials. Vercel project is `pokeflip-studio`. Production deployment must be approved/tested after linking repository.