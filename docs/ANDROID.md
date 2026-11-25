# Android app (Capacitor wrapper)

The Android app is the same no-build web app, wrapped with [Capacitor](https://capacitorjs.com) in `mobile/`. The website on Vercel is unchanged and remains the web backup. **Nothing in this document has been verified on a physical device yet** — see "Verification status".

## How it is built

```
repo root (website)  ──copy SHELL files from sw.js──▶  mobile/www  ──cap sync──▶  mobile/android (Gradle)
vendored libs (npm devDeps): supabase-js, tesseract.js + core + eng/fra language data ──▶ mobile/www/vendor
```

- `mobile/scripts/build-web.mjs` assembles `mobile/www`: the same files the service worker caches, plus vendored libraries. The CDN `<script>` tags (jsdelivr) are rewritten **only inside `www/index.html`**; the website's `index.html` is untouched. The app shell therefore loads offline (card lookup and prices need the network).
- `mobile/web-overlay/native-bridge.js` (native only): hardware back button, status bar colour, splash hide, deep-link handling, local notifications. On the website it is not loaded.
- `cloud-sync.js` and `restock-watch.js` (shared with the website) call `window.PokeFlipNative` only when it exists.
- `.vercelignore` contains `mobile/` so website deploys ignore this folder.

## Build locally

Requires Node 22, JDK 21 and the Android SDK (Android Studio installs both).

```powershell
cd mobile
npm ci
npm test
npm run build:web
npx cap sync android
cd android
.\gradlew assembleDebug      # APK: app\build\outputs\apk\debug\app-debug.apk
```

Install on a phone with USB debugging: `adb install -r app\build\outputs\apk\debug\app-debug.apk`.

## CI (`.github/workflows/android.yml`)

| Trigger | Job | Output |
|---|---|---|
| pull request, push to `feat/android-**` | `debug-apk` | artifact `pokeflip-debug-apk` |
| tag `v*` (e.g. `v4.3.0`) | `release-aab` | artifact `pokeflip-release-aab` (signed) |

Version is derived from the tag: `v4.3.0` → versionName `4.3.0`, versionCode `40300` (`major*10000 + minor*100 + patch`). Debug builds use the run number as versionCode. Play requires versionCode to increase with every upload.

### Repository secrets the owner adds (Settings → Secrets and variables → Actions)

| Secret | Content |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | upload keystore file, base64 (PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("upload.keystore"))`) |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | key alias |
| `ANDROID_KEY_PASSWORD` | key password (often same as keystore password) |

Create the keystore once, offline, with `keytool -genkeypair -v -keystore upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000`. **Back it up outside the repo** (`*.keystore`, `*.jks` are git-ignored). Use Play App Signing: this is only the *upload* key, which Google can reset if lost. The release job fails with a clear message if the secret is missing; no secret is ever written to the repo. The release job only uploads the AAB as a workflow artifact; uploading to Play is manual (or a later step once a service-account secret exists).

## Sign-in redirects (Supabase)

The app opens the email magic link through the custom scheme `top.kcaron.cardstudio://auth`. Supabase refuses redirect targets that are not allow-listed.

**Supabase dashboard → Authentication → URL Configuration (configured by the owner on 2026-11-22 — see status below):**

```
top.kcaron.cardstudio://auth
top.kcaron.cardstudio://**
```


**Email template — NOT done, blocked:** Supabase locks email-template editing until a custom SMTP provider is configured, so the 6-digit `{{ .Token }}` code is **not in the email yet** (the owner needs an SMTP provider first, then add `{{ .Token }}` next to `{{ .ConfirmationURL }}` in Authentication → Email Templates → Magic Link). Until then sign-in on the phone depends on the magic link opening the app via the custom scheme; this is untested on a device. The app already accepts a typed code once the email carries it. **Ready to do:** the owner steps (Resend, DNS, Supabase SMTP fields) and the bilingual templates are in [AUTH-EMAIL-SMTP.md](AUTH-EMAIL-SMTP.md) and `supabase/email-templates/`.

Behaviour implemented: `#access_token=…&refresh_token=…` → `client.auth.setSession`; `?code=…` → `exchangeCodeForSession`; links from any other scheme or host are ignored; an `error` fragment is shown to the user.

Note: the sign-in link must be opened on the same phone that has the app installed. On Android, custom-scheme links from Gmail's in-app browser sometimes do not launch the app; copying the code is the fallback.

## Native behaviour

| Feature | Implementation | Notes |
|---|---|---|
| Back button | `App.backButton`: closes an open dialog → drawer → returns to Prices → exits | |
| Status bar | `#111a2e`, light icons | |
| Icon / splash | generated from `icon-512.png`; adaptive icon background `#0B1220` | |
| Restock alerts | `@capacitor/local-notifications` (local only, from checks the user records in the app) | no server push; app is not polling retailers in the background |
| Offline | all assets in the APK; card lookup, TCGdex prices and cloud sync need the network | |
| Backup | `allowBackup=false` so inventory is not copied into Google auto-backup; use the app's JSON export or cloud sync | |

## Verification status (honest)

Verified locally (Windows, Node 22): web bundle assembly, bundle completeness test, `parseAuthUrl` unit tests, manifest/signing checks, root `npm run check`, Chromium UI suites for the website, and the built `www` served over localhost in desktop Chromium: no external requests, bundled Tesseract worker/core/English data ran an OCR job offline (desktop Chromium, not the Android WebView).

**Not verified:** Gradle build (no Android SDK on the authoring machine — verify via the GitHub Actions run), APK install on a Pixel, deep-link return from the email, local notification permission and delivery, back-button behaviour, splash/icon rendering, plugin access through `window.Capacitor.Plugins` without a bundler.
