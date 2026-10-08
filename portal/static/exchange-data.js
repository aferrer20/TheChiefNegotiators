// The Chief Negotiators Exchange — data layer
// The exchange is public: visitors never sign in.
//   Lots and open requirements live in Supabase (config.exchange.supabaseUrl /
//   supabaseAnonKey). Anyone can read what is listed; only admins signed in
//   to the desk console can change it (enforced by row-level security in
//   portal/supabase-exchange.sql, not by this file).
//   Every enquiry from the page goes to the sales inbox through Formspree.
(function () {
  'use strict';

  var CFG = window.TCN_CONFIG || {};
  var X = CFG.exchange || {};
  var listeners = [];
  function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }

  // Speed to lead: every enquiry lands in the sales inbox through Formspree,
  // so someone can call inside the hour.
  function notify(subject, fields) {
    var fs = CFG.formspree || {};
    var url = fs.lead || fs.contact;
    if (!url) return Promise.resolve(false);
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(Object.assign({ _subject: subject }, fields)),
    }).then(function (r) { return r.ok; }, function () { return false; });
  }

  var configured = !!(X.supabaseUrl && X.supabaseAnonKey);
  var sb = configured && window.supabase && window.supabase.createClient
    ? window.supabase.createClient(X.supabaseUrl, X.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'tcnx-desk-auth' } })
    : null;

  function friendly(e) {
    var m = (e && (e.message || e.error_description)) || String(e);
    if (/Invalid login credentials/i.test(m)) return 'Email or password is wrong.';
    if (/Email not confirmed/i.test(m)) return 'This login is not confirmed. In Supabase, open Authentication -> Users and confirm it (or re-create it with "Auto Confirm User").';
    if (/row-level security|permission denied/i.test(m)) return 'This login is not an exchange admin. Add its email to exchange_admins in Supabase (see the setup guide).';
    if (/relation .* does not exist|Could not find the table/i.test(m)) return 'The exchange tables are missing. Run portal/supabase-exchange.sql in the Supabase SQL Editor.';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Could not reach Supabase. Check your connection and the Supabase URL in config.js.';
    return m;
  }
  function ok(r) { if (r.error) { var e = new Error(friendly(r.error)); e.raw = r.error; throw e; } return r.data; }
  function need() { if (!sb) throw new Error(configured ? 'The Supabase library did not load. Check your connection and reload.' : 'Supabase is not connected yet. Add supabaseUrl and supabaseAnonKey in static/config.js.'); }

  // Public ordering: desk picks first, under-offer lots last, newest first.
  function sortLots(a) {
    return a.map(function (l, i) { return Object.assign({}, l, { id: l.ref, _row: i }); })
      .sort(function (x, y) { return (!!y.featured - !!x.featured) || ((x.status === 'reserved') - (y.status === 'reserved')) || (x._row - y._row); });
  }
  var LOT_COLS = 'ref, kind, model, config, gpu_count, condition, region, available, price, price_unit, term_months, deposit_pct, min_commit, featured, status, notes, created_at';
  var LOT_FIELDS = ['ref', 'kind', 'model', 'config', 'gpu_count', 'condition', 'region', 'available', 'price', 'price_unit', 'term_months', 'deposit_pct', 'min_commit', 'featured', 'status', 'notes'];
  var REQ_FIELDS = ['kind', 'model', 'gpu_count', 'region', 'timeline', 'status'];
  function pick(o, keys) { var r = {}; keys.forEach(function (k) { if (o[k] !== undefined) r[k] = o[k] === '' ? null : o[k]; }); return r; }

  var api = {
    mode: sb ? 'live' : 'unconfigured',
    ready: function () { return Promise.resolve(); },
    floor: async function () {
      if (!sb) return [];
      // The status filter matters for a signed-in admin, who is allowed to read hidden lots too.
      return sortLots(ok(await sb.from('exchange_lots').select(LOT_COLS).in('status', ['live', 'reserved']).order('created_at', { ascending: false })));
    },
    demand: async function () {
      if (!sb) return [];
      return ok(await sb.from('exchange_requirements').select('id, kind, model, gpu_count, region, timeline, created_at').eq('status', 'open').order('created_at', { ascending: false }));
    },
    notify: notify,
    admin: {
      configured: function () { return !!sb; },
      session: async function () { if (!sb) return null; return (await sb.auth.getSession()).data.session; },
      signIn: async function (email, password) { need(); return ok(await sb.auth.signInWithPassword({ email: email, password: password })).session; },
      signOut: async function () { if (sb) await sb.auth.signOut(); },
      isAdmin: async function () { need(); return !!ok(await sb.rpc('is_exchange_admin')); },
      list: async function () {
        need();
        var a = await Promise.all([
          sb.from('exchange_lots').select('id, ' + LOT_COLS + ', updated_at').order('created_at', { ascending: false }),
          sb.from('exchange_requirements').select('*').order('created_at', { ascending: false }),
        ]);
        return { lots: ok(a[0]), requirements: ok(a[1]) };
      },
      saveLot: async function (lot) {
        need();
        var row = pick(lot, LOT_FIELDS);
        if (lot.id) return ok(await sb.from('exchange_lots').update(row).eq('id', lot.id).select().single());
        return ok(await sb.from('exchange_lots').insert(row).select().single());
      },
      deleteLot: async function (id) { need(); ok(await sb.from('exchange_lots').delete().eq('id', id)); },
      importLots: async function (rows) { need(); return ok(await sb.from('exchange_lots').upsert(rows.map(function (r) { return pick(r, LOT_FIELDS); }), { onConflict: 'ref' }).select()); },
      saveReq: async function (req) {
        need();
        var row = pick(req, REQ_FIELDS);
        if (req.id) return ok(await sb.from('exchange_requirements').update(row).eq('id', req.id).select().single());
        return ok(await sb.from('exchange_requirements').insert(row).select().single());
      },
      deleteReq: async function (id) { need(); ok(await sb.from('exchange_requirements').delete().eq('id', id)); },
    },
  };

  // Keep the floor current while the page is open.
  var every = Math.max(Number(X.refreshMs) || 60000, 15000);
  if (sb) setInterval(function () { if (!document.hidden) emit(); }, every);

  api.onChange = function (fn) { listeners.push(fn); };
  api.config = X;
  api.bookingLink = X.bookingLink || (CFG.contact && CFG.contact.bookingLink) || '';
  window.TCNX = api;
})();
