# Google Play readiness

Status: **draft for the owner; nothing has been submitted.** No Play Console, signing or Supabase changes were made. Answers below describe what the code does today (checked by reading the source and network hosts); the owner must confirm them in the Play Console and re-check before each release.

## 1. NAME RISK — read before creating the Play listing

**"PokéFlip Studio" was likely to be rejected or taken down.** Google Play's Intellectual Property and Impersonation policies let a trademark owner (here Nintendo / Creatures / GAME FREAK / The Pokémon Company) force removal of an app whose title, icon or developer name uses their mark. "Poké" + a word is commonly treated as confusingly similar to POKÉMON. A removal also counts against the developer account. Do not buy the Play listing under this name.

Also keep out of the **title, short description, icon, feature graphic and screenshots' captions**: "Pokémon", "Poké", "Pikachu", character names, the Poké Ball, official logos/fonts. The existing icon (tile with a ring) is original and fine. In the long description, a plain factual mention of the card game is a grey area; safest is "trading cards" / "collectible card game cards", plus a disclaimer: *"Not affiliated with, endorsed or sponsored by Nintendo, Creatures Inc., GAME FREAK inc. or The Pokémon Company. Card names and images belong to their respective owners."*

**Card images:** the app does not bundle any card art. Images and card data are loaded at run time from the public TCGdex API (`api.tcgdex.net`) for cards the user looks up. TCGdex is a community catalogue; it does not give the app ownership of the artwork, which remains the trademark/copyright of the card publisher. Reviewers can still flag an app that displays card art. Mitigations: keep images runtime-only (never in the APK, never in store screenshots unless the owner accepts the risk), keep the disclaimer in the listing and in Settings, and use screenshots of the app's own UI with the inventory/lookup screens cropped or with generic content.

**Original name candidates considered** (none contains a third-party mark; **availability on Play, trademark databases (CIPO/USPTO) and domains has NOT been checked** — do that before choosing):

1. **Binderly** — a binder-style collection and resale tracker.
2. **Foilbook** — collection log with a holo/foil nod.
3. **Cardstead** — a "homestead" for a growing card collection.

The Android `applicationId` is already `top.kcaron.cardstudio` (neutral). **applicationId can never change after the first upload**, so it is safe now; the visible name is only `app_name` in `mobile/android/app/src/main/res/values/strings.xml` and `appName` in `mobile/capacitor.config.json`, plus a few strings in `index.html`/`manifest.webmanifest` (the website may keep its name).

Rename checklist (done for the app/web layer; remaining items are Play listing title, developer name and privacy policy host): `strings.xml` (`app_name`, `title_activity_main`) · `capacitor.config.json` `appName` · header/title text and `manifest.webmanifest` in the web layer if the app should match · Play listing title (max 30 characters) · developer name (do not use the same mark) · privacy policy title.

## 2. Privacy policy (text to host at a public URL, e.g. GitHub Pages or the website; required by Play)

> **Privacy Policy — Cardstead**  *Last updated: [date]*
>
> **Who we are.** Cardstead is a collection-tracking and resale-planning app published by [Developer legal name / contact email].
>
> **Data that stays on your phone.** The cards, purchase lots, sales, notes, prices and settings you enter are stored on your device. If you never sign in, none of this leaves your phone.
>
> **Camera.** The camera is used only to scan cards. Camera images are processed on your device (text recognition runs locally) and are not uploaded or stored by the developer.
>
> **Optional cloud backup.** If you choose to sign in with your email address, your email address and a copy of your collection data are stored in a database hosted by Supabase in Canada (Montréal region). Access is restricted to your account. You can download your data, and you can ask us to delete your account and data at [contact email]. Signing in is optional.
>
> **Card lookup.** When you look up a card, the card name, set and number you entered or scanned are sent to the TCGdex public card database (api.tcgdex.net) to retrieve card details, images and published reference prices. No account details are sent.
>
> **Notifications.** If you allow notifications, the app shows local notifications on your device for restock-alert checks you recorded. No notification token is sent to any server.
>
> **Links.** Links to retailers, eBay and search engines open in your browser; their own privacy policies apply.
>
> **What we do not do.** No advertising, no analytics or tracking SDKs, no sale or sharing of your data for marketing, no collection of precise location or contacts.
>
> **Retention and deletion.** Local data is removed when you clear the app's data or uninstall. Cloud data is kept until you delete it or ask us to delete your account.
>
> **Children.** The app is not directed at children under 13.
>
> **Prices.** Reference prices are informational. They are not appraisals, grades, financial advice or completed-sale records.
>
> **Contact.** [email]

Owner to fill: legal/developer name, contact email, date. If analytics, crash reporting or ads are ever added, this policy and the Data safety form must change first.

## 3. Data safety form (draft answers)

Basis: web code reviewed for network hosts: `*.supabase.co` (auth + snapshot), `api.tcgdex.net` (lookup), nothing else is called by the app itself.

| Question | Answer |
|---|---|
| Does the app collect or share user data? | **Collects** (optional, only when signing in). **Shares: No** (Supabase and TCGdex act as processors/service providers; confirm Google's definition when filling in). |
| Email address | Collected; purpose: account management / app functionality; optional; **encrypted in transit: Yes**; user can request deletion: Yes |
| Other user-generated content (inventory/collection data) | Collected only with cloud backup on; purpose: app functionality (backup/sync); optional; encrypted in transit: Yes; deletion on request |
| Photos / videos | **Not collected** (camera frames processed on-device only; not transmitted) |
| Location, contacts, financial info, health, messages, web history, device IDs | Not collected |
| App activity / analytics / diagnostics | Not collected (no analytics or crash SDK) |
| Advertising ID | Not used; app contains no ads |
| Data deletion | Provide a way to request deletion: email in the listing + privacy policy. *Play now also requires a web link for account deletion if the app lets users create accounts — the owner must publish a simple page or form for this.* **Open item: no in-app "delete my account" exists yet.** |
| Encryption in transit | Yes (HTTPS only) |

## 4. Content rating (IARC questionnaire notes)

Category: Utility/Reference (not a game). Expected answers: no violence, no sexual content, no profanity, no controlled substances, no gambling or simulated gambling (the app tracks resale prices; it does not sell or buy anything), no user-to-user communication, no location sharing, no digital purchases. Card art shown from the catalogue can include cartoon fantasy creatures — answer "cartoon/fantasy" only if the questionnaire asks about displayed content. Expected result: Everyone / PEGI 3 (confirm in the console).

Other declarations: target audience 13+ / general audience, not primarily children (avoids the Families policy); no ads; not a government/health/finance app. The app shows price information — keep the in-app wording "informational, not financial advice" (it already says to verify prices).

## 5. Permissions declared (Play Console "App content")

| Permission | Why |
|---|---|
| `INTERNET` | lookup, sign-in, sync |
| `CAMERA` | card scanner (feature declared not required) |
| `POST_NOTIFICATIONS` | local restock-alert notifications (Android 13+, runtime prompt) |

No location, contacts, storage-wide, microphone or background permissions.

## 6. Store listing assets and screenshots list

- App icon 512×512 PNG (existing `icon-512.png` is usable; avoid transparency issues — it is opaque).
- Feature graphic 1024×500 (to design; no third-party marks).
- Phone screenshots, min. 2, recommended 6–8, 9:16, from a Pixel in the final build:
  1. Dashboard (collection value tiles, empty-state-safe demo data)
  2. Scanner — Single Card mode with the guide frame
  3. Scanner — Stack Mode
  4. Review queue (unknown items go to Review)
  5. Inventory list with search/filter
  6. Buy-or-pass deal helper
  7. Sealed-product / restock watch
  8. Settings → cloud backup & export
- Short description (≤80 chars), full description (≤4000 chars): factual, no price/ranking claims, no "official", no "grade" claims. Do not claim that scanned condition equals a formal grade; do not claim live eBay sold data.
- Use only demo data in screenshots; no personal inventory.

## 7. Release checklist for the owner

1. Name is decided (Cardstead, section 1); the Play developer account already exists (fee paid). Note Google's closed-testing requirement for new personal accounts (≥12 testers for 14 days before production — confirm current rules).
2. Create the upload keystore and add the four GitHub secrets (`docs/ANDROID.md`).
3. Supabase redirect URLs are configured; the email template (`{{ .Token }}` code) still needs a custom SMTP provider first (`docs/ANDROID.md`).
4. Host the privacy policy; add an account-deletion request page.
5. Push a tag `vX.Y.Z` → download the AAB artifact → upload to an internal test track.
6. Test on a Pixel: scan, offline launch, sign-in via emailed code and link, notification, back button. Only then promote.
7. Target API: `targetSdk 36` is set by Capacitor 8; Play's requirement moves yearly — check at upload time.
