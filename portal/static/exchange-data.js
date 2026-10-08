// The Chief Negotiators Exchange — data layer
// The exchange is public: no accounts, no sign-in.
//   Lots and open requirements come from a published Google Sheet
//   (config.exchange.lotsSheetCsvUrl / requirementsSheetCsvUrl).
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

  // ---------------------------------------------------------------
  // CSV (handles quoted fields, commas and newlines inside quotes)
  // ---------------------------------------------------------------
  function parseCSV(text) {
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    rows = rows.filter(function (r) { return r.some(function (v) { return String(v).trim() !== ''; }); });
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return String(h).trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); });
    return rows.slice(1).map(function (r) {
      var o = {};
      head.forEach(function (h, j) { o[h] = String(r[j] == null ? '' : r[j]).trim(); });
      return o;
    });
  }
  function col(o, names) { for (var i = 0; i < names.length; i++) { if (o[names[i]] != null && o[names[i]] !== '') return o[names[i]]; } return ''; }
  function numOrNull(v) { v = String(v || '').replace(/[$,%\s]/g, ''); if (v === '') return null; var n = Number(v); return isFinite(n) ? n : null; }
  function kindOf(v) { return /aas|cloud|capacity|hr|hour/i.test(v || '') ? 'gpuaas' : 'hardware'; }
  function slug(s) { return String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(); }

  // Sheet row -> lot. Column names are case-insensitive.
  function lotFromRow(o, i) {
    var st = col(o, ['status']).toLowerCase();
    if (/^(hidden|hide|draft|closed|sold|inactive|off|no|n)$/.test(st)) return null;
    var model = col(o, ['model', 'gpu']);
    var gpus = numOrNull(col(o, ['gpus', 'gpu count', 'quantity', 'qty']));
    if (!model || !gpus) return null;
    var price = numOrNull(col(o, ['price', 'rate']));
    var ref = col(o, ['ref', 'lot', 'reference', 'lot ref']) || ('TCN-' + slug(model) + '-' + String(401 + i).padStart(4, '0'));
    if (/^\d+$/.test(ref)) ref = 'TCN-' + slug(model) + '-' + ref.padStart(4, '0');
    return {
      id: ref, ref: ref,
      kind: kindOf(col(o, ['type', 'kind'])),
      model: model,
      config: col(o, ['config', 'configuration', 'form factor']) || null,
      gpu_count: gpus,
      condition: col(o, ['condition']) || null,
      region: col(o, ['region', 'location']) || null,
      available: col(o, ['available', 'availability', 'lead text', 'timing']) || null,
      price: price,
      price_unit: col(o, ['price unit', 'unit']) || (kindOf(col(o, ['type', 'kind'])) === 'gpuaas' ? 'per GPU-hr' : 'per GPU'),
      term_months: numOrNull(col(o, ['term months', 'term'])),
      deposit_pct: numOrNull(col(o, ['deposit', 'deposit pct', 'deposit percent'])),
      min_commit: numOrNull(col(o, ['min order', 'minimum order', 'min commit', 'minimum'])),
      featured: /^(y|yes|true|1|x|featured|desk pick)$/i.test(col(o, ['featured', 'desk pick'])),
      status: /offer|reserv/.test(st) ? 'reserved' : 'live',
      notes: col(o, ['notes', 'description']) || null,
      _row: i,
    };
  }
  function reqFromRow(o, i) {
    var st = col(o, ['status']).toLowerCase();
    if (st && !/open|live|active/.test(st)) return null;
    var model = col(o, ['model', 'gpu']);
    var gpus = numOrNull(col(o, ['gpus', 'gpu count', 'quantity', 'qty']));
    if (!model || !gpus) return null;
    var t = col(o, ['type', 'kind']);
    return {
      id: 'r_' + i, kind: !t ? 'either' : /either|any|both/i.test(t) ? 'either' : kindOf(t),
      model: model, gpu_count: gpus,
      region: col(o, ['region', 'location']) || null,
      timeline: col(o, ['timeline', 'timing', 'needed by']) || null,
    };
  }

  var cache = { lots: null, reqs: null };

  async function fetchSheet(url) {
    var r = await fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + '_=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('Sheet returned ' + r.status);
    return parseCSV(await r.text());
  }
  function sortLots(a) {
    return a.sort(function (x, y) { return (y.featured - x.featured) || ((x.status === 'reserved') - (y.status === 'reserved')) || (x._row - y._row); });
  }

  var api = {
    mode: X.lotsSheetCsvUrl ? 'sheet' : 'empty',
    ready: function () { return Promise.resolve(); },
    floor: async function () {
      if (X.lotsSheetCsvUrl) {
        try { cache.lots = sortLots((await fetchSheet(X.lotsSheetCsvUrl)).map(lotFromRow).filter(Boolean)); }
        catch (e) { console.error(e); if (!cache.lots) throw e; }
        return cache.lots;
      }
      return [];
    },
    demand: async function () {
      if (X.requirementsSheetCsvUrl) {
        try { cache.reqs = (await fetchSheet(X.requirementsSheetCsvUrl)).map(reqFromRow).filter(Boolean); }
        catch (e) { console.error(e); if (!cache.reqs) throw e; }
        return cache.reqs;
      }
      return [];
    },
    notify: notify,
  };

  // Keep the floor current while the page is open.
  var every = Number(X.refreshMs || CFG.inventoryRefreshMs) || 60000;
  if (X.lotsSheetCsvUrl || X.requirementsSheetCsvUrl) setInterval(function () { if (!document.hidden) emit(); }, Math.max(every, 15000));

  api.onChange = function (fn) { listeners.push(fn); };
  api.config = X;
  api.bookingLink = X.bookingLink || (CFG.contact && CFG.contact.bookingLink) || '';
  window.TCNX = api;
})();
