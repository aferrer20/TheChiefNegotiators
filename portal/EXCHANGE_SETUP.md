# The Chief Negotiators Exchange: setup

The exchange lives in the `portal/` folder of the site repo and is served at **https://portal.thechiefnegotiators.com** by the same Vercel project as the main site (host-based rewrites in `vercel.json`). `www.portal.thechiefnegotiators.com` redirects to it. Until step 2 is done, the exchange runs in **preview mode**: sample lots, stored only in each visitor's browser, with a bar at the bottom to view it as a guest, applicant, buyer or seller.

## What's in the folder

| File | What it is |
|---|---|
| `portal/exchange.html` | The public marketplace (served at `/`) |
| `portal/admin.html` | Desk console (served at `/admin`), now with the Exchange tab and rebuilt Prospect Desk |
| `portal/assets/exchange-data.js` | Data layer (Supabase when configured, preview data otherwise) |
| `portal/assets/exchange.js`, `assets/exchange.css` | Exchange interface |
| `portal/assets/exchange-admin.js` | Exchange tab in the console |
| `portal/assets/prospect-desk.js` | Prospect Desk v2 (replaces the old desk script) |
| `portal/assets/config.js` | Your config, with a new `exchange` block |
| `portal/assets/app.js`, `leads.js`, `chrome.js` | Your existing scripts (chrome.js gains an Exchange nav link) |
| `portal/schema.sql` | Database, security rules and triggers |
| `api/prospect.mjs` | Server-side AI for the Prospect Desk (Vercel function at `/api/prospect`) |
| `vercel.json` (repo root) | Routes the portal host to `portal/`, keeps admin out of search |


## 1. Deploy and connect the domain

1. Merge to `main`; Vercel deploys as usual.
2. **Vercel → Project → Settings → Domains → Add**: `portal.thechiefnegotiators.com`. Also add `www.portal.thechiefnegotiators.com` (vercel.json redirects it to the bare portal host).
3. At your DNS provider, add a `CNAME` record for `portal` (and `www.portal`) pointing to `cname.vercel-dns.com` (or the exact value Vercel shows). Vercel issues the SSL certificate automatically.
4. Visit https://portal.thechiefnegotiators.com to see preview mode.

## 2. Go live with Supabase (about 15 minutes)

1. Create a project at supabase.com (the free tier is enough to start).
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**. If it reports an error, send it to me with the line number.
3. **Authentication → URL Configuration**
   - Site URL: `https://portal.thechiefnegotiators.com`
   - Redirect URLs: add `https://portal.thechiefnegotiators.com/**`
4. **Authentication → Emails**: edit the "Magic Link" and "Confirm signup" templates so they read as The Chief Negotiators. For volume, set up custom SMTP (Resend or Postmark), because Supabase's built-in mailer is rate-limited.
5. **Project Settings → API**: copy the Project URL and the `anon` public key into `portal/assets/config.js`:
   ```js
   exchange: {
     supabaseUrl:     "https://xxxx.supabase.co",
     supabaseAnonKey: "eyJ...",
     ...
   }
   ```
   The anon key is designed to be public. The security comes from the row-level rules in the schema.
6. Redeploy.
7. **Make yourself admin.** Apply on https://portal.thechiefnegotiators.com with `sales@thechiefnegotiators.com`, click the email link, then run this in the SQL Editor:
   ```sql
   update public.members set is_admin = true, status = 'approved'
    where email = 'sales@thechiefnegotiators.com';
   ```
8. Open https://portal.thechiefnegotiators.com/admin → Exchange tab → sign in with the same email.
9. **Seed the floor.** In the console, approve your own account as a seller (it already is), then submit your real lots from the portal → *Submit a lot*, and put them live from the Exchange tab. Or add rows in Supabase → Table Editor → `listings` with `status = live`.

## 3. Turn on the Prospect Desk engine

In Vercel → **Project → Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your key from console.anthropic.com (required) |
| `DESK_KEY` | Any long random string (recommended) |
| `ANTHROPIC_MODEL` | Optional; defaults to `claude-sonnet-5-5` |
| `ALLOWED_ORIGIN` | Optional; `https://portal.thechiefnegotiators.com` |

Redeploy, then in the console: Prospect Desk → **Desk settings** → paste the same `DESK_KEY`, and check the closer name, booking link, time zone and exchange URL.

The playbook drafts (opener, follow-up touches, call ask) work without the engine. The engine adds thread reading, objection handling, live-lot references and call briefs.

## How leads reach you

- Every application, introduction, new lot and requirement is also emailed through your existing Formspree contact endpoint (or `formspree.lead` if you set one). Subjects start with the tier and `CALL NOW` when the lead is hot, so you can set an inbox rule or phone alert on that phrase.
- The console's **Call now** queue shows the same leads with a clock; red means past an hour.

## Daily rhythm that books the most calls

1. **Exchange → Call now.** Clear it first. Approve applicants on the call, not before.
2. **Prospect Desk → Due now.** Replies owed first, then follow-up touches, then openers.
3. **Exchange → Matches.** Any open requirement with a live lot is an introduction email you can send today.
4. Share lot links (`https://portal.thechiefnegotiators.com/exchange#lot=TCN-...`) in outreach. The desk inserts them automatically.

## Before you launch publicly

- **Protect `admin.html`.** Live exchange data already requires an admin sign-in, but the page itself and the desk's local data are reachable by anyone with the URL. Put it behind Vercel password protection / Deployment Protection, or move it to a separate private project.
- **Review the legal copy.** Have counsel review the lot disclaimer in the footer, your NCNDA, and the member terms.
- **Watch your email limits.** Supabase's default email limits are low, so set up custom SMTP before driving traffic.
