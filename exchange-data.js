// The Chief Negotiators Exchange — data layer
// One interface, two adapters:
//   live  -> Supabase (Postgres + passwordless auth + row-level security)
//   demo  -> this browser only, seeded with sample listings, used until
//            supabaseUrl + supabaseAnonKey are filled in config.js
(function () {
  'use strict';

  var CFG = window.TCN_CONFIG || {};
  var X = CFG.exchange || {};
  var listeners = [];
  function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }

  // Speed to lead: every application and introduction also lands in the
  // sales inbox through Formspree, so someone can call inside the hour.
  function notify(subject, fields) {
    var fs = CFG.formspree || {};
    var url = fs.lead || fs.contact;
    if (!url) return;
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(Object.assign({ _subject: subject }, fields)),
    }).catch(function () {});
  }

  // =================================================================
  // LIVE ADAPTER (Supabase)
  // =================================================================
  function liveAdapter() {
    var sb = window.supabase.createClient(X.supabaseUrl, X.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    var current = null;

    async function refreshSession() {
      var s = (await sb.auth.getSession()).data.session;
      if (!s) { current = null; return null; }
      var m = (await sb.from('members').select('*').eq('id', s.user.id).maybeSingle()).data;
      current = { user: s.user, member: m || { status: 'pending', email: s.user.email } };
      return current;
    }
    sb.auth.onAuthStateChange(function () { refreshSession().then(emit); });

    function ok(r) { if (r.error) throw new Error(r.error.message); return r.data; }
    var redirect = location.origin + location.pathname;

    return {
      mode: 'live',
      ready: refreshSession,
      session: function () { return current; },
      floor: async function () { return ok(await sb.from('floor').select('*').order('featured', { ascending: false }).order('created_at', { ascending: false })); },
      demand: async function () { return ok(await sb.from('demand').select('*').order('created_at', { ascending: false })); },
      apply: async function (app) {
        ok(await sb.auth.signInWithOtp({ email: app.email, options: { data: { application: app }, emailRedirectTo: redirect } }));
        return { sent: true };
      },
      signIn: async function (email) {
        ok(await sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: false, emailRedirectTo: redirect } }));
        return { sent: true };
      },
      signOut: async function () { await sb.auth.signOut(); current = null; emit(); },
      requestIntro: async function (i) { return ok(await sb.from('intros').insert(i).select().single()); },
      submitListing: async function (l) { return ok(await sb.from('listings').insert(l).select().single()); },
      postRequirement: async function (r) { return ok(await sb.from('requirements').insert(r).select().single()); },
      mine: async function () {
        var uid = current && current.user.id;
        if (!uid) return { listings: [], requirements: [], intros: [] };
        var a = await Promise.all([
          sb.from('listings').select('*').eq('seller_id', uid).order('created_at', { ascending: false }),
          sb.from('requirements').select('*').eq('buyer_id', uid).order('created_at', { ascending: false }),
          sb.from('my_intros').select('*').order('created_at', { ascending: false }),
        ]);
        return { listings: ok(a[0]), requirements: ok(a[1]), intros: ok(a[2]) };
      },
      admin: {
        members: async function () { return ok(await sb.from('members').select('*').order('created_at', { ascending: false })); },
        reviewMember: async function (id, status) { return ok(await sb.rpc('admin_review_member', { member: id, new_status: status })); },
        listings: async function () { return ok(await sb.from('listings').select('*, seller:members(company, full_name, email, phone)').order('created_at', { ascending: false })); },
        setListing: async function (id, patch) { return ok(await sb.from('listings').update(patch).eq('id', id)); },
        requirements: async function () { return ok(await sb.from('requirements').select('*, buyer:members(company, full_name, email, phone, tier, score)').order('created_at', { ascending: false })); },
        setRequirement: async function (id, patch) { return ok(await sb.from('requirements').update(patch).eq('id', id)); },
        intros: async function () { return ok(await sb.from('intros').select('*, member:members(company, full_name, email, phone, title, tier, score, side), listing:listings(ref, model, gpu_count, kind, seller:members(company, full_name, email, phone)), requirement:requirements(model, gpu_count, region, timeline)').order('created_at', { ascending: false })); },
        setIntro: async function (id, patch) { patch.updated_at = new Date().toISOString(); return ok(await sb.from('intros').update(patch).eq('id', id)); },
      },
      notify: notify,
    };
  }

  // =================================================================
  // DEMO ADAPTER (localStorage) — same shapes as the live views
  // =================================================================
  function demoAdapter() {
    var KEY = 'tcnx_demo_v1';
    var DAY = 86400000, now = Date.now();
    function iso(t) { return new Date(t).toISOString(); }
    function uid(p) { return p + Math.random().toString(36).slice(2, 10); }

    function seed() {
      var L = function (o) { return Object.assign({ id: uid('l_'), status: 'live', featured: false, created_at: iso(now - Math.random() * 9 * DAY), seller_id: 'm_seller1' }, o); };
      return {
        as: 'guest', me: null,
        members: [
          { id: 'm_seller1', email: 'capacity@northbeam-compute.example', full_name: 'Elena Marsh', company: 'Northbeam Compute', title: 'VP Capacity', phone: '+1 (512) 555-0144', side: 'seller', score: 0, tier: null, status: 'approved', created_at: iso(now - 40 * DAY), answers: {} },
          { id: 'm_buyer1', email: 'jwells@meridian-ai.example', full_name: 'Jordan Wells', company: 'Meridian AI Labs', title: 'Head of Infrastructure', phone: '+1 (415) 555-0199', side: 'buyer', score: 84, tier: 'priority', status: 'approved', created_at: iso(now - 12 * DAY), answers: { orgType: 'neocloud', quantity: '1025', budget: '25m', authority: 'budget', nvidiaHistory: 'direct' } },
          { id: 'm_app1', email: 'r.osei@halcyonbio.example', full_name: 'Ruth Osei', company: 'Halcyon Bio', title: 'CTO', phone: '+1 (617) 555-0123', side: 'buyer', score: 71, tier: 'qualified', status: 'pending', created_at: iso(now - 2 * 3600000), answers: { orgType: 'enterprise', quantity: '257', budget: '5m', authority: 'signer', nvidiaHistory: 'partner' } },
          { id: 'm_app2', email: 'deals@gpu-flip.example', full_name: 'Marco Ruiz', company: 'GPU Flip Ltd', title: 'Partner', phone: '', side: 'buyer', score: 23, tier: 'waitlist', status: 'pending', created_at: iso(now - 5 * 3600000), answers: { orgType: 'broker', quantity: '64', budget: 'tbd', authority: 'research', nvidiaHistory: 'none' } },
        ],
        listings: [
          L({ ref: 'TCN-VERARUBIN-0401', kind: 'gpuaas', model: 'Vera Rubin', config: 'NVL144 racks', gpu_count: 3600, region: 'United States', available: 'Q1 2027', price: 8.00, price_unit: 'per GPU-hr', term_months: 60, deposit_pct: 30, min_commit: 576, featured: true, notes: 'Single-tenant cluster. Liquid cooled, InfiniBand fabric. Ramp schedule negotiable for anchor tenants.' }),
          L({ ref: 'TCN-GB300-0402', kind: 'gpuaas', model: 'GB300', config: 'NVL72 racks', gpu_count: 2304, region: 'United States', available: 'Q1 2027', price: 4.40, price_unit: 'per GPU-hr', term_months: 60, deposit_pct: 20, min_commit: 576, featured: true, notes: '32 racks. Direct liquid cooling. Bare metal with managed Kubernetes option.' }),
          L({ ref: 'TCN-B300-0403', kind: 'gpuaas', model: 'B300', config: 'HGX 8-GPU nodes', gpu_count: 1024, region: 'United States', available: 'Q4 2026', price: 4.45, price_unit: 'per GPU-hr', term_months: 36, deposit_pct: 25, min_commit: 256, notes: '128 nodes. Earliest-live B300 block on the floor.' }),
          L({ ref: 'TCN-B300-0404', kind: 'gpuaas', model: 'B300', config: 'HGX 8-GPU nodes', gpu_count: 496, region: 'Canada', available: 'Q1 2027', price: 4.30, price_unit: 'per GPU-hr', term_months: 60, deposit_pct: 20, min_commit: 128, notes: '62 nodes. Hydro-powered site.' }),
          L({ ref: 'TCN-B300-0405', kind: 'hardware', model: 'B300', config: 'HGX 8-GPU', gpu_count: 256, condition: 'New, sealed', region: 'United States', available: 'Q1 2027', price: null, price_unit: 'per GPU', min_commit: 64, notes: 'OEM-allocated. End-user documentation required.' }),
          L({ ref: 'TCN-H200-0406', kind: 'hardware', model: 'H200', config: 'HGX 8-GPU', gpu_count: 512, condition: 'New, sealed', region: 'EU', available: 'Immediate', price: null, price_unit: 'per GPU', min_commit: 64, status: 'reserved', notes: 'In bonded warehouse, Frankfurt.' }),
          L({ ref: 'TCN-B200-0407', kind: 'hardware', model: 'B200', config: 'HGX 8-GPU', gpu_count: 192, condition: 'New, sealed', region: 'United States', available: '30 days', price: null, price_unit: 'per GPU', min_commit: 64, notes: '' }),
          L({ ref: 'TCN-H100-0408', kind: 'hardware', model: 'H100', config: 'SXM5', gpu_count: 128, condition: 'New, open box', region: 'United States', available: 'Immediate', price: null, price_unit: 'per GPU', min_commit: 64, notes: 'Burn-in reports available.' }),
          L({ ref: 'TCN-H200-0409', kind: 'gpuaas', model: 'H200', config: 'HGX 8-GPU nodes', gpu_count: 640, region: 'Canada', available: 'Q1 2027', price: 2.95, price_unit: 'per GPU-hr', term_months: 24, deposit_pct: 15, min_commit: 64, status: 'review', seller_id: 'm_seller1', notes: 'Submitted by seller, awaiting desk review.' }),
        ],
        requirements: [
          { id: 'r_1', buyer_id: 'm_buyer1', kind: 'gpuaas', model: 'B300', gpu_count: 1024, region: 'United States', timeline: 'Live by Q1 2027', budget: '$25M–$100M', notes: '3-year term preferred', status: 'open', created_at: iso(now - 3 * DAY) },
          { id: 'r_2', buyer_id: 'm_buyer1', kind: 'hardware', model: 'H200', gpu_count: 256, region: 'EU', timeline: 'Within 60 days', budget: '$5M–$25M', notes: '', status: 'open', created_at: iso(now - 6 * DAY) },
        ],
        intros: [
          { id: 'i_1', member_id: 'm_buyer1', direction: 'buy', listing_id: null, requirement_id: null, gpu_count: 1024, timeline: 'Q1 2027', message: 'Want to understand ramp schedule and whether 3-year term is possible.', phone: '+1 (415) 555-0199', status: 'call_booked', created_at: iso(now - 2 * DAY), updated_at: iso(now - DAY) },
        ],
      };
    }

    function load() {
      try { var d = JSON.parse(localStorage.getItem(KEY)); if (d && d.listings) return d; } catch (e) {}
      var s = seed();
      // link the seeded intro to the B300 block
      s.intros[0].listing_id = s.listings[2].id;
      save(s); return s;
    }
    function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
    var db = load();
    function tick(fn) { return new Promise(function (r) { setTimeout(function () { r(fn()); }, 120); }); }
    function memberById(id) { return db.members.filter(function (m) { return m.id === id; })[0] || null; }
    function listingById(id) { return db.listings.filter(function (l) { return l.id === id; })[0] || null; }
    function reqById(id) { return db.requirements.filter(function (r) { return r.id === id; })[0] || null; }
    function me() { return memberById(db.me); }
    function isMember() { var m = me(); return !!(m && m.status === 'approved'); }
    function pick(o, keys) { var r = {}; keys.forEach(function (k) { r[k] = o[k]; }); return r; }

    // Preview personas, so the owner can see every view of the exchange.
    function becomePersona(as) {
      db.as = as;
      if (as === 'guest') db.me = null;
      if (as === 'member') db.me = 'm_buyer1';
      if (as === 'seller') db.me = 'm_seller1';
      if (as === 'admin') { db.me = 'm_admin'; if (!memberById('m_admin')) db.members.push({ id: 'm_admin', email: CFG.contact && CFG.contact.email, full_name: 'TCN Desk', company: 'The Chief Negotiators', side: 'both', status: 'approved', is_admin: true, created_at: iso(now) }); }
      if (as === 'pending') { db.me = 'm_app1'; }
      save(db); emit();
    }

    return {
      mode: 'demo',
      persona: function () { return db.as; },
      setPersona: becomePersona,
      reset: function () { localStorage.removeItem(KEY); db = load(); emit(); },
      ready: function () { return Promise.resolve(this.session()); },
      session: function () { var m = me(); return m ? { user: { id: m.id, email: m.email }, member: m } : null; },
      floor: function () {
        return tick(function () {
          var mem = isMember();
          return db.listings.filter(function (l) { return l.status === 'live' || l.status === 'reserved'; })
            .sort(function (a, b) { return (b.featured - a.featured) || (b.created_at > a.created_at ? 1 : -1); })
            .map(function (l) {
              var o = pick(l, ['id', 'ref', 'kind', 'model', 'config', 'gpu_count', 'condition', 'region', 'available', 'term_months', 'min_commit', 'featured', 'status', 'created_at']);
              o.has_price = l.price != null;
              if (mem) Object.assign(o, pick(l, ['price', 'price_unit', 'deposit_pct', 'notes']));
              return o;
            });
        });
      },
      demand: function () {
        return tick(function () {
          if (!isMember()) return [];
          return db.requirements.filter(function (r) { return r.status === 'open'; }).map(function (r) { return pick(r, ['id', 'kind', 'model', 'gpu_count', 'region', 'timeline', 'created_at']); });
        });
      },
      apply: function (app) {
        return tick(function () {
          var m = { id: uid('m_'), email: app.email, full_name: app.name, company: app.company, title: app.title, phone: app.phone, website: app.website, side: app.side || 'buyer', answers: app, score: app.score || 0, tier: app.tier, status: 'pending', created_at: iso(Date.now()) };
          db.members.unshift(m); db.me = m.id; db.as = 'pending'; save(db); emit();
          return { sent: true, demo: true };
        });
      },
      signIn: function (email) {
        return tick(function () {
          var m = db.members.filter(function (x) { return (x.email || '').toLowerCase() === email.toLowerCase(); })[0];
          if (!m) throw new Error('No application found for that email. Apply first.');
          db.me = m.id; db.as = m.is_admin ? 'admin' : m.status === 'approved' ? 'member' : 'pending'; save(db); emit();
          return { sent: true, demo: true };
        });
      },
      signOut: function () { return tick(function () { db.me = null; db.as = 'guest'; save(db); emit(); }); },
      requestIntro: function (i) {
        return tick(function () {
          if (!isMember()) throw new Error('Approved members only.');
          var r = Object.assign({ id: uid('i_'), member_id: db.me, status: 'new', created_at: iso(Date.now()), updated_at: iso(Date.now()) }, i);
          db.intros.unshift(r); save(db); emit(); return r;
        });
      },
      submitListing: function (l) {
        return tick(function () {
          if (!isMember()) throw new Error('Approved members only.');
          var seq = 410 + db.listings.length;
          var r = Object.assign({ id: uid('l_'), seller_id: db.me, status: 'review', featured: false, created_at: iso(Date.now()) }, l);
          r.ref = 'TCN-' + String(l.model).replace(/[^A-Za-z0-9]/g, '').toUpperCase() + '-0' + seq;
          db.listings.unshift(r); save(db); emit(); return r;
        });
      },
      postRequirement: function (q) {
        return tick(function () {
          if (!isMember()) throw new Error('Approved members only.');
          var r = Object.assign({ id: uid('r_'), buyer_id: db.me, status: 'open', created_at: iso(Date.now()) }, q);
          db.requirements.unshift(r); save(db); emit(); return r;
        });
      },
      mine: function () {
        return tick(function () {
          return {
            listings: db.listings.filter(function (l) { return l.seller_id === db.me; }),
            requirements: db.requirements.filter(function (r) { return r.buyer_id === db.me; }),
            intros: db.intros.filter(function (i) { return i.member_id === db.me; }).map(function (i) {
              var l = listingById(i.listing_id) || {}, q = reqById(i.requirement_id) || {};
              return Object.assign({}, i, { listing_ref: l.ref, listing_model: l.model, requirement_model: q.model, requirement_gpus: q.gpu_count });
            }),
          };
        });
      },
      admin: {
        members: function () { return tick(function () { return db.members.slice(); }); },
        reviewMember: function (id, status) { return tick(function () { var m = memberById(id); if (m) { m.status = status; if (status === 'approved') m.approved_at = iso(Date.now()); } save(db); emit(); }); },
        listings: function () { return tick(function () { return db.listings.map(function (l) { var s = memberById(l.seller_id) || {}; return Object.assign({}, l, { seller: pick(s, ['company', 'full_name', 'email', 'phone']) }); }); }); },
        setListing: function (id, patch) { return tick(function () { Object.assign(listingById(id) || {}, patch); save(db); emit(); }); },
        requirements: function () { return tick(function () { return db.requirements.map(function (r) { var b = memberById(r.buyer_id) || {}; return Object.assign({}, r, { buyer: pick(b, ['company', 'full_name', 'email', 'phone', 'tier', 'score']) }); }); }); },
        setRequirement: function (id, patch) { return tick(function () { Object.assign(reqById(id) || {}, patch); save(db); emit(); }); },
        intros: function () {
          return tick(function () {
            return db.intros.map(function (i) {
              var m = memberById(i.member_id) || {}, l = listingById(i.listing_id), q = reqById(i.requirement_id);
              var s = l ? (memberById(l.seller_id) || {}) : {};
              return Object.assign({}, i, {
                member: pick(m, ['company', 'full_name', 'email', 'phone', 'title', 'tier', 'score', 'side']),
                listing: l ? Object.assign(pick(l, ['ref', 'model', 'gpu_count', 'kind']), { seller: pick(s, ['company', 'full_name', 'email', 'phone']) }) : null,
                requirement: q ? pick(q, ['model', 'gpu_count', 'region', 'timeline']) : null,
              });
            });
          });
        },
        setIntro: function (id, patch) { return tick(function () { var i = db.intros.filter(function (x) { return x.id === id; })[0]; if (i) Object.assign(i, patch, { updated_at: iso(Date.now()) }); save(db); emit(); }); },
      },
      notify: function () { /* demo: nothing leaves the browser */ },
    };
  }

  var live = !!(X.supabaseUrl && X.supabaseAnonKey && window.supabase && window.supabase.createClient);
  var api = live ? liveAdapter() : demoAdapter();
  api.onChange = function (fn) { listeners.push(fn); };
  api.config = X;
  api.bookingLink = X.bookingLink || (CFG.contact && CFG.contact.bookingLink) || '';
  window.TCNX = api;
})();
