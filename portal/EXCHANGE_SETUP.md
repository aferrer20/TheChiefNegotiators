# The Chief Negotiators Exchange: setup

The exchange is a public page at **https://portal.thechiefnegotiators.com**. Nobody signs in or creates an account. Everyone sees every lot, including price, deposit and term. Visitors act through short forms, and every form goes to the sales inbox.

It lives in the `portal/` folder of the site repo. Netlify serves it from the same site as www.thechiefnegotiators.com, using the domain rules in `_redirects`.

## What's in the folder

| File | What it is |
|---|---|
| `portal/exchange.html` | The public exchange (served at `/`) |
| `portal/admin.html` | Desk console (served at `/admin`), Exchange tab shows what is on the floor |
| `portal/static/config.js` | Settings: the Google Sheet links, Formspree endpoints, booking link |
| `portal/static/exchange-data.js` | Reads lots and requirements from the sheet; sends enquiries |
| `portal/static/exchange.js`, `exchange.css` | Exchange interface |
| `portal/static/exchange-admin.js` | Exchange tab in the console |
| `portal/static/prospect-desk.js` | Prospect Desk |
| `netlify/functions/prospect.mjs` (repo root) | Server-side AI for the Prospect Desk |
| `_redirects` (repo root) | Routes the portal domain to `portal/` |

## 1. Connect the domain

1. Merge to `main` on GitHub; Netlify deploys as usual.
2. **Netlify → Domain management → Add a domain alias**: `portal.thechiefnegotiators.com`. Add `www.portal.thechiefnegotiators.com` too; it redirects to the bare portal address.
3. If the domain uses Netlify DNS, the records are created for you. Otherwise, at your DNS provider, add a `CNAME` for `portal` (and `www.portal`) pointing to your site's `*.netlify.app` address. Netlify issues the SSL certificate automatically.

## 2. Put your lots in a Google Sheet

1. Make a Google Sheet with a tab named **Lots**. Row 1 is the header row. Column names are not case-sensitive:

   | Column | Required | Example | Notes |
   |---|---|---|---|
   | Ref | | `TCN-B300-0403` | The lot's ID and share link. A plain number becomes `TCN-<MODEL>-<number>`. Left blank, one is made from the row order, so set it if you share lot links. |
   | Type | | `GPUaaS` or `Hardware` | Defaults to Hardware |
   | Model | yes | `B300` | |
   | Config | | `HGX 8-GPU nodes` | |
   | GPUs | yes | `1024` | |
   | Condition | | `New, sealed` | Hardware lots |
   | Region | | `United States` | Also feeds the region filter |
   | Available | | `Q1 2027` | |
   | Price | | `4.45` | Blank shows "Price on request" |
   | Price Unit | | `per GPU-hr` | Defaults to per GPU-hr (GPUaaS) or per GPU (hardware) |
   | Term Months | | `36` | GPUaaS lots |
   | Deposit | | `25` | Percent |
   | Min Order | | `256` | GPUs; defaults to 64 |
   | Featured | | `yes` | Shows a "Desk pick" tag and sorts to the top |
   | Status | | `live`, `under offer`, `hidden` | Blank means live. `hidden`, `closed` or `sold` removes it from the floor. |
   | Notes | | `Liquid cooled, InfiniBand` | Shown on the lot's detail panel |

2. Optional: add a tab named **Requirements** with `Type`, `Model`, `GPUs`, `Region`, `Timeline`, `Status` (blank or `open` shows it). These appear on the public requirements board, so put only what you're happy to show publicly. Never put buyer names here.
3. **File → Share → Publish to web**. Pick the **Lots** tab and **Comma-separated values (.csv)**, then **Publish**, and copy the link. Do the same for the Requirements tab.
4. Paste the links into `portal/static/config.js`:
   ```js
   exchange: {
     lotsSheetCsvUrl:         "https://docs.google.com/spreadsheets/d/e/.../pub?gid=...&single=true&output=csv",
     requirementsSheetCsvUrl: "https://docs.google.com/spreadsheets/d/e/.../pub?gid=...&single=true&output=csv",
     ...
   }
   ```
5. Commit to `main`. After this, editing the sheet updates the site within a minute or two (that's Google's publish delay), with no redeploy.

Until the sheet is connected, the floor shows "New lots are being added".

## 3. How enquiries reach you

Every form on the exchange emails the sales inbox through your Formspree endpoint (`formspree.lead` in config.js, or `formspree.contact` if that's blank). The subject says what kind of enquiry it is, so you can set inbox rules or phone alerts on it:

| Subject starts with | From |
|---|---|
| `[INTRO · CALL NOW]` | Someone asked for an introduction on a lot, or offered to fill a requirement |
| `[REQUIREMENT · CALL NOW]` | A buyer posted a requirement |
| `[NEW LOT · REVIEW]` | A seller submitted a lot. Verify it, then add it to the sheet to list it. |
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

- **The desk console at `/admin` is reachable by anyone with the link.** It stores its own data (leads, quotes, desk notes) only in the browser you use it on, and search engines are told not to index it. To lock it, move `admin.html` to a separate, password-protected Netlify site.
- **Prices are public.** Anything in the Price column is visible to everyone. Leave it blank for "Price on request".
- **Review the legal copy.** Have counsel review the lot disclaimer in the footer and your NCNDA.
