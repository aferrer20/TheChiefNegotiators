# The Chief Negotiators

Static HTML/CSS/JS site for **Chief Negotiators LLC** (St. Petersburg, FL) at `www.thechiefnegotiators.com`. No build step, no framework — pages are hand-authored HTML at the repo root.

Hosting is configured by `vercel.json`, whose `cleanUrls: true` is what serves every page at its extensionless URL and redirects the `.html` form to it. Internal links should therefore always point at `/page-name`, never `page-name.html`, so they do not take a redirect hop. `CNAME` (GitHub Pages) and `_headers` / `_redirects` (Netlify) are leftovers from earlier hosts and are inert on Vercel.

The firm is an independent, no-inventory AI infrastructure advisory. It negotiates GPU allocation, GPUaaS and AI cloud contracts, data center colocation, powered shell / build-to-suit, and power procurement for buyers, and sources qualified offtake and capacity commercialization for operators. It holds no inventory and takes no position in any deal — see the homepage (`index.html`) and `llms.txt` for the full description in the firm's own words.

---

## Layout

| Path | What it is |
|---|---|
| `index.html` | Homepage. |
| `gpu-clusters-gpuaas.html`, `gpu-cluster-procurement.html`, `gpuaas-contract-negotiation.html`, `data-center-capacity-sourcing.html`, `powered-shell-build-to-suit.html`, `data-center-power-procurement.html`, `buy-side-negotiation-advisory.html`, `capacity-commercialization.html` | The eight mandate pages. |
| `availability.html` | Live build-to-suit GPU cluster matcher (buyer-facing form). |
| `qualify.html` | Offtaker qualification brief, issued by request. |
| `capacity.html` | The Capacity Desk (colocation sourcing). |
| `insights.html` + `insight-*.html` | The blog. |
| `assets/` | Stylesheet (`tcn.css`), analytics loader (`analytics.js`), availability-matcher script, logos, share card. |
| `sitemap.xml`, `robots.txt`, `llms.txt` | Search and AI-crawler configuration. |
| `_archive/` | Superseded drafts and raw uploads. Excluded from deployment by `.vercelignore` — without it Vercel publishes the directory, including an old homepage at `/_archive/deploy/index.html`. |
| `.vercelignore` | Paths kept in git but never deployed (`_archive/`, `tools/`, `github.md`). |
| `<key>.txt` (32 hex chars) | IndexNow key. Must stay at the site root and stay deployed — it is how Bing and Yandex authenticate submissions. |
| `tools/indexnow.py` | Pushes changed URLs to Bing, Yandex, Naver and Seznam. Run after a deploy. |

---

## Getting new pages indexed

**Google** — through Search Console. Add the property at
[search.google.com/search-console](https://search.google.com/search-console), verify with the
**Google Analytics** method (`assets/analytics.js` loads `G-HWR479H49B` on every page, so this
works without touching the repo), submit `sitemap.xml`, then use URL Inspection → Request
indexing for anything new.

**Bing, Yandex, Naver, Seznam** — through IndexNow, which needs no account:

```bash
python3 tools/indexnow.py --check    # confirm the key file is live
python3 tools/indexnow.py            # submit every URL in sitemap.xml
python3 tools/indexnow.py /some-new-page
```

Run it *after* the deploy. The engines fetch the key file to authenticate the batch, so a
submission made before the key is live is rejected — the script checks first and refuses to
send. Google does not participate in IndexNow, so this is in addition to Search Console, not
instead of it.

---

## Editing conventions

Every real page shares the same structure: full meta/OG/Twitter tags, a canonical URL, JSON-LD (`Organization`/`ProfessionalService`/`WebSite` on the homepage; `Service`/`FAQPage`/`BreadcrumbList` on mandate pages; `Article`/`FAQPage`/`BreadcrumbList` on insight posts), the identical `<nav>` and `<footer>` blocks, and `assets/tcn.css` for styling. When adding a page, copy the structure of the closest existing example rather than starting from scratch, and add the new URL to `sitemap.xml` and the footer nav.

Lead capture goes through two channels: [Web3Forms](https://web3forms.com) (`https://api.web3forms.com/submit`) for the inquiry forms, and a Microsoft Bookings link for scheduled calls. `assets/analytics.js` fires GA4 events (`generate_lead`, `book_call_click`, `contact_email_click`, `phone_click`, `availability_enquiry`) on both.

Content voice: short declarative sentences, direct answers to the objections a buyer or operator would actually raise, no unverifiable numbers or claims about third parties. Company names appear only in neutral, factual, well-known context (e.g. category — "hyperscalers such as AWS, Azure, Google Cloud and Oracle" — not disputed specifics like pricing or SLA terms).
