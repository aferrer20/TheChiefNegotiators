# The Chief Negotiators Exchange: setup

The exchange is a public page at **https://portal.thechiefnegotiators.com**. Nobody signs in or creates an account. Everyone sees every lot, including price, deposit and term. Visitors act through short forms, and every form goes to the sales inbox.

It lives in the `portal/` folder of the site repo. Netlify serves it from the same site as www.thechiefnegotiators.com, using the domain rules in `_redirects`.

## What's in the folder

| File | What it is |
|---|---|
| `portal/exchange.html` | The public exchange (served at `/`) |
| `portal/admin.html` | Desk console (served at `/admin`). The Exchange tab is where you add and edit lots and requirements |
| `portal/static/config.js` | Settings: Formspree endpoints, booking link, function addresses |
| `portal/static/exchange-data.js` | Loads the floor from the exchange function; sends enquiries |
| `portal/static/exchange.js`, `exchange.css` | Exchange interface |
| `portal/static/exchange-admin.js` | Exchange editor in the console |
| `portal/static/prospect-desk.js` | Prospect Desk |
| `netlify/functions/exchange.mjs` (repo root) | Stores lots and requirements in Netlify Blobs; editing needs the admin password |
| `netlify/functions/prospect.mjs` (repo root) | Server-side AI for the Prospect Desk |
| `package.json` (repo root) | Lets Netlify install `@netlify/blobs` for the exchange function |
| `_redirects` (repo root) | Routes the portal domain to `portal/` |

## 1. Connect the domain

1. Merge to `main` on GitHub; Netlify deploys as usual.
2. **Netlify → Domain management → Add a domain alias**: `portal.thechiefnegotiators.com`. Add `www.portal.thechiefnegotiators.com` too; it redirects to the bare portal address.
3. If the domain uses Netlify DNS, the records are created for you. Otherwise, at your DNS provider, add a `CNAME` for `portal` (and `www.portal`) pointing to your site's `*.netlify.app` address. Netlify issues the SSL certificate automatically.

## 2. Load your lots in the console

1. **Set the editor password.** In Netlify, go to **Site configuration → Environment variables → Add a variable**: key `EXCHANGE_ADMIN_PASSWORD`, value a long password. Then **Deploys → Trigger deploy** so the function picks it up.
2. **Open the editor.** Go to https://portal.thechiefnegotiators.com/admin, open the **Exchange** tab, and enter the password. It stays unlocked until you close the browser tab or click **Lock**.
3. **Add lots:**
   - **Add lot** opens a form. Model and GPUs are required; everything else is optional. Each lot gets a reference like `TCN-B300-0405`, which is also its share link.
   - **Import CSV** adds many lots at once. Row 1 must be the column headers; Model and GPUs (or Quantity) are required. Recognised columns: Ref, Type (GPUaaS or Hardware), Model, Config (or Form Factor), GPUs (or Quantity), Condition, Region, Available (or Lead Text / Lead Days), Price, Price Unit, Term Months, Deposit, Min Order, Featured, Status, Notes. A row whose Ref matches an existing lot updates that lot instead of adding a new one. To bring lots over from Google Sheets, use File → Download → CSV.
4. **Manage the floor.** Each lot's **Status** menu sets it to Live, Under offer, or Hidden (taken off the exchange but kept). Use **Desk pick** to feature a lot at the top, **Edit** to change it, and **Copy link** for outreach. Every change saves immediately and shows on the exchange within a minute.
5. **Requirements board.** **Add requirement** posts a public "buyer is looking for" row. Never include the buyer's name. Use **Close** to take one down.

The lots are stored on Netlify (Netlify Blobs), so there's no other service to sign up for. If two people edit at once, the second save is refused and the editor reloads the latest version, so nobody overwrites anyone else's changes.

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

- **The desk console at `/admin` is reachable by anyone with the link.** It stores its own data (leads, quotes, desk notes) only in the browser you use it on, and search engines are told not to index it. To lock it, move `admin.html` to a separate, password-protected Netlify site.
- **Prices are public.** Any price you enter on a lot is visible to everyone. Leave it blank for "Price on request".
- **Use a long, unique exchange password.** Anyone who has it can change the floor. To change it, update `EXCHANGE_ADMIN_PASSWORD` in Netlify and redeploy.
- **Review the legal copy.** Have counsel review the lot disclaimer in the footer and your NCNDA.
