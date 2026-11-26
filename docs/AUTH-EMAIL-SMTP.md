# Sign-in emails: custom SMTP for Supabase (owner steps)

**Why:**
- Supabase's built-in email sends only **2 sign-in emails an hour**, and only to the project team's addresses. A third person signing in within the hour gets nothing. This is audit item C3.
- Supabase also locks the email templates until a custom sender is set. So the 6-digit code that Cardstead's "Code received by email" box expects is not in the email yet.

**Result after these steps:**
- About 30 emails an hour, up to 100 a day on Resend's free plan.
- The email carries the code and the link, in French (tu) and English.
- It comes from `Cardstead <connexion@mail.kcaron.top>`.

You create the account and the key, and paste the key only into Supabase. Never put it in the repository, a chat or a file.

## Provider: Resend (free)

| | Resend free | Brevo free |
|---|---|---|
| Volume | 100 emails a day, 3,000 a month | About 300 a day (check brevo.com/pricing; it could not be confirmed on 23 November 2026) |
| Domains | 3 custom domains | Several senders |
| SMTP | `smtp.resend.com`, user `resend`, password = an API key | `smtp-relay.brevo.com`, port 587, login and SMTP key from the Brevo dashboard |
| Why pick it | Simplest setup, one API key, good deliverability, clean dashboard of sent emails | Higher daily volume; more marketing-oriented, and adds its own branding on the free plan for campaigns |

**Recommendation: Resend.** 100 sign-ins a day is far above Cardstead's current use. Switching to Brevo later is the same five Supabase fields.

## Sender domain: `mail.kcaron.top`

- `kcaron.top` is yours and already on Cloudflare DNS (checked 23 November 2026). It has no mail records (no MX, SPF or DMARC), so nothing conflicts.
- Resend recommends sending from a **subdomain**. `mail.kcaron.top` keeps sign-in mail apart from anything else on the domain, and Guilded or Goblin Ledger can reuse it later. That is one of Resend's 3 free domains.
- If Cardstead later gets its own domain, add it in Resend and change only the sender email in Supabase.

## Step 1: Resend account and domain (about 10 minutes)

1. Sign up at resend.com with your own email.
2. **Domains > Add domain**, then enter `mail.kcaron.top`. Region: North America (us-east-1) is closest to Québec.
3. Resend shows **3 DNS records** (an MX, an SPF TXT and a DKIM TXT). Copy them exactly as shown, because names and values are specific to your domain. They usually look like this; trust the screen over this list:
   - `MX` at `send.mail` → `feedback-smtp.us-east-1.amazonses.com`, priority 10;
   - `TXT` at `send.mail` → `v=spf1 include:amazonses.com ~all`;
   - `TXT` at `resend._domainkey.mail` → a long `p=...` key.
4. In **Cloudflare > kcaron.top > DNS > Records**, add each one. Leave TXT and MX records as "DNS only" (Cloudflare cannot proxy them).
5. Add a DMARC record so inboxes trust the mail:
   - `TXT` at `_dmarc.mail` → `v=DMARC1; p=none; rua=mailto:YOUR-ADDRESS`. Use an address you read.
   - `p=none` only reports. You can tighten it to `p=quarantine` after a few weeks of clean reports.
6. Back in Resend, press **Verify DNS records**. It usually turns green within minutes; DNS can take up to an hour.
7. **API Keys > Create API key**:
   - name `supabase-auth`;
   - permission **Sending access**;
   - domain `mail.kcaron.top`.
   Copy the key once. You paste it in Step 2 and nowhere else. If it leaks, delete it in Resend and create a new one.

## Step 2: Supabase settings (Cardstead project)

**Authentication > Emails > SMTP Settings** (dashboard path `/auth/smtp`), then turn on **Enable custom SMTP**:

| Field | Value |
|---|---|
| Sender email | `connexion@mail.kcaron.top` |
| Sender name | `Cardstead` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the Resend API key from Step 1.7 |
| Minimum interval between emails | leave the default (60 seconds per user) |

Save.

**Authentication > Rate Limits** (`/auth/rate-limits`): with custom SMTP the email limit becomes 30 an hour. Keep 30. It stays inside Resend's 100 a day and limits abuse of the open sign-up.

## Step 3: email templates (in this repository)

**Authentication > Emails > Templates**. For each template, paste the subject and the whole file as the body:

| Template | Subject | Body |
|---|---|---|
| Magic Link | `Ton code Cardstead : {{ .Token }} / Your Cardstead code` | `supabase/email-templates/magic-link.html` |
| Confirm signup | `Bienvenue dans Cardstead : ton code {{ .Token }} / Welcome to Cardstead` | `supabase/email-templates/confirm-signup.html` |

Both show the **6-digit code** (`{{ .Token }}`), which the app's "Code received by email" box accepts, and the **link** (`{{ .ConfirmationURL }}`). French comes first, in "tu", then English.

The code is the reliable path on Android, since some mail apps open links in their own browser. Supabase notes that link scanners can use up a link before you tap it; the code is not affected.

## Step 4: test (2 minutes)

1. On the website and on the phone: **Settings > Your account and backup**, enter your email, then **Email me a code**.
2. The email arrives from `Cardstead <connexion@mail.kcaron.top>` with a 6-digit code. Type it in Cardstead: you are signed in.
3. Resend > **Emails** lists the message as Delivered. If it went to spam, check that the DKIM and DMARC records are verified.
4. Send three sign-in emails within an hour to different addresses. All arrive (before, the third failed).

When it works, update `RELEASE-STATUS.md` and `docs/ANDROID.md`: custom SMTP is set and the code is in the email.

## If you move the site to Cloudflare Pages

Nothing here changes: the sender and templates do not depend on the site address. Only the Supabase **Site URL** and **Redirect URLs** change (see `docs/CLOUDFLARE-MOVE.md`).
