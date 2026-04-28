# Chief Negotiators — Design System

> **The Art of the Better Deal.**

Chief Negotiators is a premium consultancy serving executives and founders through contract negotiation, vendor renewal strategy, IT spend audits, and partnership advisory. Their model is performance-based ("0% Risk to You — 100% Performance Based") and the brand reflects that: restrained, executive, and confident — closer to a bespoke law firm or family-office than a SaaS startup.

The visual language pairs a **deep black canvas** with a single **warm champagne-rose accent (#C49F8C)** and a **classical serif voice** (Cormorant Garamond–style display + ITC Cardo–style body). The mark is a **chess Knight in line-art** — the strategic piece that moves where others can't.

---

## Sources

- **Live site:** https://www.thechiefnegotiators.com (CNAME on `aferrer20/TheChiefNegotiators`)
- **GitHub:** `aferrer20/TheChiefNegotiators` (CNAME-only — site itself is a static HTML build not committed to the repo)
- **Reference screenshot:** `uploads/Chief-Negotiators.png` — full-page capture of the live landing site, 2400×4194. This is the ground truth.

The two GitHub repos provided (`aferrer20/TheChiefNegotiators`, `Chief-Negotiators/LandingPage`) contain only a CNAME and an empty README respectively, so this design system was reconstructed primarily from the live-site screenshot and from common values for the brand's font choices.

---

## Products

There is **one surface**: the marketing landing site (`www.thechiefnegotiators.com`). It is single-page, scroll-driven, and acts as both pitch and credentialing artifact. There is no app, no dashboard, no authenticated product. The UI kit accordingly focuses on marketing-page primitives: hero, service grid, process timeline, value pillars, CTA.

---

## Index — what's in this folder

| Path | What it is |
|---|---|
| `README.md` | You are here. Brand context, content fundamentals, visual foundations, iconography. |
| `colors_and_type.css` | All design tokens: color palette, type scale, semantic vars (h1, h2, body, caption…). |
| `fonts/` | Web-font files (Cormorant Garamond, Cardo). |
| `assets/` | Logos, the Knight mark, line-icon SVGs. |
| `preview/` | Card files (~700×variable px) that populate the **Design System** tab — color, type, components. |
| `ui_kits/landing_site/` | High-fidelity recreation of the marketing site with reusable JSX components. |
| `SKILL.md` | Agent Skill manifest — makes this folder portable to Claude Code. |

---

## Content fundamentals

The voice is **executive, declarative, and confident** — short sentences, no hedging, no hype, no exclamation points. Copy reads like the back-cover blurb of a hardcover business book, not a SaaS landing page.

**Tone & devices**
- **Italics for emphasis on a single key word** inside a serif headline: *"The Art of the Better Deal."* Italics carry the weight; the rest of the line is roman.
- **Triadic phrasing** appears repeatedly. *"We negotiate, we build, we grow."* / *"Simple. Strategic. Results-Driven."* / *"We go in. We negotiate. You save."* Three short clauses, periods between them.
- **Em-dashes** for asides, never parentheses. *"…so you can lead."* / *"No savings — no fee."*
- **Capitalization:** Headlines use **Title Case** (every major word capitalized). Body copy is sentence case. Service names are Title Case ("IT Spend Audit", "Renewal Strategy").
- **Pronoun stance:** "We" for Chief Negotiators, "you/your" for the client. Never first-person singular. The client is always positioned as the protagonist; CN is the strategist behind them.
- **No emoji. No exclamation points.** Anywhere. The brand's gravitas depends on this.
- **Numbers stay numerals** when used as proof points: "0% Risk to You", "100% Performance Based", "90–120 days".

**Vocabulary the brand owns**
- *Advocate, advocacy* (used as a noun: "Precision Advocacy")
- *Leverage* (verb and noun)
- *Position / position of strength*
- *The fine print*
- *Total cost of ownership (TCO)*
- *Vendor / partnership / renewal* — the three core service nouns
- *Disciplined, uncompromising, seasoned* — adjectives applied to CN's process
- *Bottom line* — appears in marquee headlines

**Sample copy in voice**
> Your strategic advocate at every table. We negotiate, we build, we grow — so you can lead.

> From defining ideal partner profiles to structuring mutually beneficial agreements, we bring a disciplined framework to your partnership strategy.

> We go in. We negotiate. You save. *No savings — no fee. It's that simple.*

**What the voice avoids**
- "Empower," "unlock," "supercharge," "level up," any growth-hacker verb
- "We're excited to…" / "We believe…"
- Stats with trailing decimals ("47.3% improvement")
- Customer logos / "trusted by" social proof — the brand sells discretion, not popularity

---

## Visual foundations

**Canvas.** Pure black `#000000` — full-bleed, no gradients, no texture. The black is doing the heavy lifting; never lighten it to charcoal. Sections are separated by generous vertical whitespace (~120–160px between blocks at 1440 width), not by background-color shifts.

**Color.** A **mono-accent system**. One champagne-rose `#C49F8C` does all the brand work — logo, headline, italic emphasis, icon strokes, numbered timeline markers, decorative accents. White and warm grays carry the body. There is no secondary brand color, no semantic palette of greens/reds/blues. When a "card" is needed, it's `#464342` (a warm dark gray) sitting on the black canvas — never bordered, never shadowed, just a flat surface change.

**Type.**
- **Display:** Cormorant Garamond, 400 + 700 + 400-italic. The italic is doing real work — it shows up inside headlines for one or two words and gives the brand its "literary" feel.
- **Body:** Cardo (or near-equivalent serif). Light weight, generous tracking, sits comfortably on black at 14–16px.
- **Sans is not used.** Anywhere. The entire site is serif end-to-end. Resist any urge to introduce a sans for "UI elements" — there are no UI elements.
- **Tracking on small caps / labels:** ~0.15em letterspacing on labels like service names sitting above body copy.

**Spacing.** Section padding is large and consistent — think 96–144px top/bottom on hero sections, 64–96px on internal sections. Card internal padding is 32–48px. The site breathes; whitespace is a brand signal of premium.

**Backgrounds & imagery.** No photography on the landing site. No illustration. No texture. No gradient. The only graphics are: the Knight logomark and three line-art icons (shield, person-with-bar-chart, infinity). All other "imagery" is typography.

**Animation.** Minimal-to-none on first load. Where motion appears, it should be **slow fades** (300–500ms, ease-out) on scroll-into-view — never bouncy, never sliding. The brand should feel still and considered, not kinetic.

**Hover states.** On gold accents (links, button-equivalents): brighten the gold slightly (`#D8B5A2`) or shift to white. On dark cards: lighten the surface ~6% to `#535050`. **Never** use a colored ring or focus glow — keep the keyboard ring as a 1px gold outline-offset 2.

**Press states.** ~98% scale, ~150ms ease-in. No color flash.

**Borders.** The only border in the system is a **hairline 1px in `#6F6C6C` at ~50% opacity** used to separate timeline rows and divide the four-up service cards. Cards themselves are borderless — they're surface-on-surface. The "Now Watch How Often It Plays" pill is the one exception: hairline gold border, all-caps tracked label.

**Shadows.** None. The brand has zero drop-shadows. Surface is communicated by tone (dark gray block on black), not elevation.

**Corner radii.** **Sharp corners everywhere** — 0px on cards, 0px on the pill capsule. The classical seriousness of the type doesn't tolerate softness. Buttons, when needed in the UI kit, get a 2px radius at most.

**Capsules vs. gradients.** The brand uses **outlined capsules** (1px hairline rectangles with a tracked all-caps label inside) for kicker labels. Never gradient buttons. Never glassmorphism. Never blur.

**Layout rules.** Center-aligned on desktop for hero/section headers. Body paragraphs are constrained to ~640px max-width and centered. Service grid is 2×2 on desktop, single column on mobile. The numbered process timeline is left-aligned with alternating left/right text columns connected by a thin vertical gold rule.

**Cards.** Flat dark-gray (`#464342`) on black, no border, no shadow, no radius. Title in gold (Cormorant Garamond Bold, ~22px), body below in white at 14–15px.

**Iconography vibe.** Outlined, single-weight stroke (~2px at 64px icon size), gold color, generous interior space. See ICONOGRAPHY below.

---

## Iconography

The site uses **three custom line-art icons** plus the **Knight logomark**. All four share the same visual treatment: gold (`#C49F8C`), 2px stroke, square cap, no fill, generous padding inside the bounding box.

**Inventory (lifted from the screenshot, recreated as SVG in `assets/`):**
- `assets/knight.svg` — the brand mark. Chess Knight in profile, line-art only, no fill.
- `assets/icon-shield.svg` — used at "0% Risk to You". Shield outline with a checkmark inside.
- `assets/icon-figure-chart.svg` — used at "100% Performance Based". Standing figure beside an upward bar chart.
- `assets/icon-infinity.svg` — used at "Infinite Upside Potential". Lemniscate, unbroken stroke.

**Rules**
- **No icon font.** No Font Awesome, no Material Icons, no Lucide.
- **No emoji. No unicode dingbats.** Anywhere in product surfaces.
- **No filled glyphs.** All icons are outline-only.
- **Color:** always the brand gold `#C49F8C`. Icons are never white, never multi-color.
- **Stroke:** 2px at 64px, scales linearly. Round joins, square caps.
- **Sizing:** 56–72px is the natural size — these are display icons, not UI affordances. Don't shrink below 32px.

**Substitution policy.** If new icons are needed beyond the four above, the closest CDN match is **Lucide** (https://lucide.dev) — it shares the outline + 2px stroke + square-cap sensibility. Lucide icons must be re-stroked in `#C49F8C`, never used in their default near-black. Flag every new icon to the brand owner before shipping; the four custom marks above should remain the dominant visuals.

---

## Font substitutions (flagged)

The live site appears to use **Cormorant Garamond** for display and **Cardo** for body — both are freely available on Google Fonts, so I've imported those directly via `@import` in `colors_and_type.css` rather than substituting. If the brand owner has licensed alternatives (e.g. a commercial Garamond cut), drop the .woff2 files into `fonts/` and update the `@font-face` declarations.

---

## Quick reference — what to do (and not to do)

| ✅ Do | ❌ Don't |
|---|---|
| Pure black `#000000` background | Charcoal `#1a1a1a`, navy, or "almost black" |
| One gold accent `#C49F8C` | A second brand color, gradient gold, or yellow |
| Cormorant Garamond + Cardo | Inter, Roboto, system-ui, any sans |
| Italics on one word inside a headline | Italicize whole sentences |
| Sharp 0px corners | Rounded buttons, pill cards |
| Outlined line-art icons in gold | Filled icons, emoji, unicode glyphs |
| Triadic short sentences with periods | Run-on marketing copy |
| Generous whitespace, 0 shadows | Drop-shadows, "elevated" cards |

