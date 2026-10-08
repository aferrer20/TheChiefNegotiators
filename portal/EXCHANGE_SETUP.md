# The Chief Negotiators Exchange: setup

The exchange is a public page at **https://www.thechiefnegotiators.com/portal/exchange**. Visitors never sign in. Everyone sees every listed lot, including price, deposit and term, and acts through short forms that go to the sales inbox.

It lives in the `portal/` folder of the site repo, so it is published wherever the site is (GitHub Pages today). Lots and requirements are stored in **Supabase** and edited in the desk console at `/portal/admin`.

## What's in the folder

| File | What it is |
|---|---|
| `portal/exchange.html` | The public exchange (`/portal/exchange`) |
| `portal/admin.html` | Desk console (`/portal/admin`). The Exchange tab is where you add and edit lots and requirements |
| `portal/static/config.js` | Settings: Supabase URL and key, Formspree endpoints, booking link |
| `portal/static/exchange-data.js` | Reads and saves lots in Supabase; sends enquiries |
| `portal/static/exchange.js`, `exchange.css` | Exchange interface |
| `portal/static/exchange-admin.js` | Exchange editor in the console |
| `portal/static/prospect-desk.js` | Prospect Desk |
| `portal/supabase-exchange.sql` | Creates the Supabase tables and the rules for who can read and change them |
| `netlify/functions/prospect.mjs` (repo root) | Server-side AI for the Prospect Desk |
| `_redirects` (repo root) | Routes portal.thechiefnegotiators.com to `portal/` (only once the domain is served by Netlify) |

## 1. Set up Supabase (one time, about 5 minutes)

Your project: `https://pqfeumdtqzopkfqreney.supabase.co`

1. **Create the tables.** Supabase → **SQL Editor → New query**. Paste all of `portal/supabase-exchange.sql`, change the email near the bottom to the one you'll sign in with, and click **Run**. It's safe to run again later.
2. **Create your login.** Supabase → **Authentication → Users → Add user → Create new user**. Use the same email, choose a password, and tick **Auto Confirm User**.
3. **Copy the public key.** Supabase → **Project Settings → API Keys**. Copy the **anon / public** key (or the **publishable** key, `sb_publishable_…`). This key is meant to be public; the rules from step 1 decide what it can do. Paste it into `supabaseAnonKey` in `portal/static/config.js` (the URL is already filled in) and commit to `main`. Never use the **service_role** or **secret** key here.

To add another admin later, run `insert into public.exchange_admins (email) values ('name@thechiefnegotiators.com');` in the SQL Editor and create their login as in step 2.

## 2. Load your lots in the console

1. **Sign in.** Go to https://www.thechiefnegotiators.com/portal/admin, open the **Exchange** tab, and sign in with the email and password from step 1.2. You stay signed in on that browser until you click **Sign out**.
2. **Add lots:**
   - **Add lot** opens a form. Model and GPUs are required; everything else is optional. Each lot gets a reference like `TCN-B300-0405`, which is also its share link.
   - **Import CSV** adds many lots at once. Row 1 must be the column headers; Model and GPUs (or Quantity) are required. Recognised columns: Ref, Type (GPUaaS or Hardware), Model, Config (or Form Factor), GPUs (or Quantity), Condition, Region, Available (or Lead Text / Lead Days), Price, Price Unit, Term Months, Deposit, Min Order, Featured, Status, Notes. A row whose Ref matches an existing lot updates that lot; a row with no Ref is added as a new lot every time you import it. To bring lots over from Google Sheets, use File → Download → CSV.
3. **Manage the floor.** Each lot's **Status** menu sets it to Live, Under offer, or Hidden (taken off the exchange but kept). Use **Desk pick** to feature a lot at the top, **Edit** to change it, and **Copy link** for outreach. Every change saves to Supabase immediately and shows on the exchange within a minute.
4. **Requirements board.** **Add requirement** posts a public "buyer is looking for" row. Never include the buyer's name. Use **Close** to take one down.

You can also edit rows directly in Supabase → **Table Editor** (`exchange_lots`, `exchange_requirements`); the exchange shows the change the same way.

## 3. How enquiries reach you

Every form on the exchange emails the sales inbox through your Formspree endpoint (`formspree.lead` in config.js, or `formspree.contact` if that's blank). The subject says what kind of enquiry it is, so you can set inbox rules or phone alerts on it:

| Subject starts with | From |
|---|---|
| `[INTRO · CALL NOW]` | Someone asked for an introduction on a lot, or offered to fill a requirement |
| `[REQUIREMENT · CALL NOW]` | A buyer posted a requirement |
| `[NEW LOT · REVIEW]` | A seller submitted a lot. Verify it, then add it in the console to list it. |
| `[CALL LINK CLICKED]` | Someone opened the booking link |

Each form asks for name, company, work email and phone. The browser remembers them, so a visitor's second enquiry takes one click.

Share lot links in outreach: `https://portal.thechiefnegotiators.com/#lot=TCN-B300-0403`. The Exchange tab in the console has a **Copy link** button for each lot.

## 4. Turn on the Prospect Desk engine

In Netlify → **Site configuration → Environment variables**:

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your key from console.anthropic.com (required) |
| `DESK_KEY` | Any long random string (recommended) |
| `ANTHROPIC_MODEL` | Optional; defaults to `claude-sonnet-5-5` |
| `ALLOWED_ORIGIN` | Optional; `https://portal.thechiefnegotiators.com` |

Redeploy. Then in the console, go to Prospect Desk → **Desk settings**, paste the same `DESK_KEY`, and check the closer name, booking link, time zone and exchange URL.

## Before you launch publicly

- **The desk console at `/portal/admin` is reachable by anyone with the link,** but the Exchange tab needs an admin sign-in. It stores its own data (leads, quotes, desk notes) only in the browser you use it on, and search engines are told not to index it. To lock it, move `admin.html` to a separate, password-protected Netlify site.
- **Prices are public.** Any price you enter on a lot is visible to everyone. Leave it blank for "Price on request".
- **Use a strong password for your Supabase login.** Anyone signed in with an email in `exchange_admins` can change the floor. Reset it in Supabase → Authentication → Users.
- **Turn off public sign-ups** in Supabase → Authentication → Sign In / Providers → Email ("Allow new users to sign up" off). Strangers still couldn't edit the exchange, but there's no reason to let them create logins.
- **Review the legal copy.** Have counsel review the lot disclaimer in the footer and your NCNDA.
