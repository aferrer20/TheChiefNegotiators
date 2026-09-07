# The Chief Negotiators

Static HTML/CSS/JS site for **Chief Negotiators LLC** (St. Petersburg, FL), served via GitHub Pages at `www.thechiefnegotiators.com` (see `CNAME`). No build step, no framework — pages are hand-authored HTML at the repo root.

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
| `security.html` | Security & compliance — how the firm handles confidential deal information. |
| `insights.html` + `insight-*.html` | The blog. |
| `assets/` | Stylesheet (`tcn.css`), analytics loader (`analytics.js`), availability-matcher script, logos, share card. |
| `sitemap.xml`, `robots.txt`, `llms.txt` | Search and AI-crawler configuration. |
| `_archive/` | Superseded drafts and raw uploads, not published by GitHub Pages. See `_archive/README.md`. |

---

## Editing conventions

Every real page shares the same structure: full meta/OG/Twitter tags, a canonical URL, JSON-LD (`Organization`/`ProfessionalService`/`WebSite` on the homepage; `Service`/`FAQPage`/`BreadcrumbList` on mandate pages; `Article`/`FAQPage`/`BreadcrumbList` on insight posts), the identical `<nav>` and `<footer>` blocks, and `assets/tcn.css` for styling. When adding a page, copy the structure of the closest existing example rather than starting from scratch, and add the new URL to `sitemap.xml` and the footer nav.

Lead capture goes through two channels: [Web3Forms](https://web3forms.com) (`https://api.web3forms.com/submit`) for the inquiry forms, and a Microsoft Bookings link for scheduled calls. `assets/analytics.js` fires GA4 events (`generate_lead`, `book_call_click`, `contact_email_click`, `phone_click`, `availability_enquiry`) on both.

Content voice: short declarative sentences, direct answers to the objections a buyer or operator would actually raise, no unverifiable numbers or claims about third parties. Company names appear only in neutral, factual, well-known context (e.g. category — "hyperscalers such as AWS, Azure, Google Cloud and Oracle" — not disputed specifics like pricing or SLA terms).
