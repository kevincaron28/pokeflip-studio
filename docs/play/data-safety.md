# Play Data safety (Cardstead)

What was saved in Play Console → App content → Data safety and sent for review on 26 Nov 2026. Update this page and `privacy.html` whenever what the app sends changes.

- Collects data: yes. Shares data: no. Encrypted in transit: yes.
- Account method: "Username and other authentication" (email sign-in, optional).
- Deletion link: `https://pokeflip-studio.vercel.app/privacy.html#delete`.

| Data type | Required? | Purpose | What it is in Cardstead |
|---|---|---|---|
| Email address | Optional | App functionality, Account management | Sign-in for cloud backup (Supabase) |
| User IDs | Optional | App functionality, Account management | Supabase account ID; Discord ID if linked |
| Purchase history | Optional | App functionality | Price paid in My cards, and older lots and sales, inside the cloud backup |
| Other user-generated content | Optional | App functionality | My cards, targets, notes and watches in the cloud backup |
| In-app search history | Required | App functionality | Card searches sent to TCGdex, and through Cardstead's server to eBay |
| Device or other IDs | Optional | App functionality | Push address or token, when drop alerts are on |

All are marked collected, not shared, and not processed ephemerally.

Judgement calls:

- **eBay listings** are shown to the user and are not user data. The search words are declared as search history, to be safe: the server caches answers for up to 6 hours, filed under the words, with no account.
- **Amazon links** open in the browser; the app sends Amazon nothing else. The affiliate disclosure is in the listing, the privacy policy and, when a tag is set, the app.
- **Supabase, Vercel, Firebase** act as service providers, so this is not "sharing".
- Not declared because the app does not collect them: location, contacts, photos, messages, diagnostics, analytics, advertising ID.
