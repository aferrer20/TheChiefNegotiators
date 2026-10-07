// The Chief Negotiators — Site configuration
// EDIT THIS FILE to wire up Formspree and Google Sheets.
// See SETUP.md or the "Setup" tab in admin.html for step-by-step instructions.

window.TCN_CONFIG = {

  // ----- FORMSPREE ENDPOINTS -----
  // 1. Sign up at https://formspree.io
  // 2. Create three forms: "Reservation", "Want to Buy", "Contact"
  // 3. Each form has an endpoint like https://formspree.io/f/xyzabcde
  // 4. Paste each endpoint URL below.
  //
  // Leave any value as the empty string "" to disable that form's submission
  // (it will still log to the local Admin console for testing).

  formspree: {
    reservation: "https://formspree.io/f/mrejwleo",
    wtb:         "https://formspree.io/f/xeenbzae",
    contact:     "https://formspree.io/f/mojrolee",
    bom:         "https://formspree.io/f/xbdwvkkq",
    // Scored allocation leads. Leave blank to fall back to the contact
    // endpoint above; set a dedicated form to keep leads in their own inbox.
    lead:        "",
  },

  // ----- GOOGLE SHEETS INVENTORY -----
  //
  // 1. Make a new Google Sheet. Row 1 must be the header row, using EXACTLY
  //    these column names (case-insensitive):
  //
  //      Model | Form Factor | Quantity | Condition | Lead Days |
  //      Lead Text | Region | Price | Notes | Updated | Status
  //
  //    - Required: Model, Quantity
  //    - "Status" can be "active" / "inactive" (leave blank = active).
  //    - "Updated" can be a date or left blank (uses the sheet's last edit time).
  //
  // 2. File > Share > Publish to web
  //    - Select the inventory sheet/tab
  //    - Choose "Comma-separated values (.csv)"
  //    - Click Publish, copy the URL
  //
  // 3. Paste the URL below. Leave empty to use local admin data instead.

  inventorySheetCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRCAUf-jizddlTAJ-eZar_8Npx2SalvtjwmgcoFJBUcClRoUjJRghanYu2Dmu6-ifR3asbPRXJrsr7-/pub?gid=0&single=true&output=csv",

  // How often to refresh inventory from the sheet (milliseconds)
  inventoryRefreshMs: 60000,

  // ----- CONTACT -----
  contact: {
    email: "sales@thechiefnegotiators.com",
    phone: "+1 (305) 610-2849",
    phoneHref: "+13056102849",
  },

  // ----- THE EXCHANGE (marketplace) -----
  // Leave the two Supabase values empty to run the exchange in preview
  // mode (sample data, stored in the visitor's browser only).
  // Fill them in to go live. Full steps: EXCHANGE_SETUP.md
  exchange: {
    supabaseUrl:     "",   // e.g. https://abcdefgh.supabase.co
    supabaseAnonKey: "",   // Project Settings -> API -> anon public key
    // Every path on the exchange ends here: a 20-minute allocation call.
    bookingLink: "https://bookings.cloud.microsoft/bookwithme/user/d68d0b6c190649deb8628fa8f622671e%40thechiefnegotiators.com?anonymous&ismsaljsauthenabled=true",
    // Prospect Desk AI endpoint (Vercel function at api/prospect.mjs).
    deskEndpoint: "/api/prospect",
  },

  // ----- QUOTE BRANDS -----
  // Quotes generated in the admin console can be issued under either brand.
  // Edit the logo path, accent color, and contact line for each. Add more
  // brands by copying a block and giving it a new key.
  brands: {
    tcn: {
      name: "The Chief Negotiators",
      logo: "assets/logo.png",     // transparent crest — prints clean on white
      accent: "#856517",          // gold
      ink: "#16130E",
      logoBg: "transparent",      // logo sits on white quote sheet
      tagline: "Verified GPU procurement.",
      contactLine: "sales@thechiefnegotiators.com · +1 (305) 610-2849",
    },
    ssp: {
      name: "Strategic Supply Partners",
      logo: "assets/ssp-logo.png",
      accent: "#0F2A5C",          // SSP navy
      ink: "#0F2A5C",
      logoBg: "transparent",
      tagline: "AI infrastructure, sourced and negotiated.",
      contactLine: "",
    },
  },
};
