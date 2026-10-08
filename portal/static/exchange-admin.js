// Admin console: Exchange tab
// Load and edit everything on the public exchange: lots and open requirements.
// Data lives in Supabase. Sign in with an email + password created in
// Supabase -> Authentication -> Users; that email must also be listed in the
// exchange_admins table (see portal/supabase-exchange.sql).
// Enquiries from the exchange arrive by email (Formspree), subject-tagged
// [INTRO · CALL NOW], [REQUIREMENT · CALL NOW] or [NEW LOT · REVIEW].
(function () {
  'use strict';
  var X = window.TCNX;
  if (!X || !X.admin || !X.admin.list) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var num = function (n) { return n == null || n === '' ? '' : Number(n).toLocaleString('en-US'); };
  var toast = function (m) { if (window.TCN && window.TCN.toast) window.TCN.toast(m); else console.log(m); };
  var base = function () { return (X.config && X.config.publicUrl) || 'https://www.thechiefnegotiators.com/portal/exchange'; };
  var openBtn = document.getElementById('xaOpenExchange'); if (openBtn) openBtn.href = base();
  var data = null;           // { lots, requirements }
  var editing = null;        // { type: 'lot'|'req', index: number|-1 }
  var busy = false, savedAt = null, error = '', who = '';

  var STATUS = { live: 'Live', reserved: 'Under offer', hidden: 'Hidden' };
  var MODELS = ['Vera Rubin', 'GB300', 'B300', 'GB200', 'B200', 'H200', 'H100', 'A100', 'L40S', 'RTX PRO 6000'];
  var REGIONS = ['United States', 'Canada', 'EU', 'UK', 'Middle East', 'APAC', 'LATAM'];

  function slug(s) { return String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'LOT'; }
  function nextRef(model, taken) {
    var max = 400;
    (data.lots || []).concat(taken || []).forEach(function (l) { var m = String(l.ref || '').match(/(\d+)$/); if (m) max = Math.max(max, +m[1]); });
    return 'TCN-' + slug(model) + '-' + String(max + 1).padStart(4, '0');
  }
  function mount() { return document.getElementById('exchangeMount'); }

  // ------------------------------------------------------------------
  // Supabase
  // ------------------------------------------------------------------
  async function enter() {
    // Signed in: confirm the login is an admin, then load everything.
    if (!(await X.admin.isAdmin())) {
      await X.admin.signOut();
      throw new Error('This login is not an exchange admin. In Supabase, add its email to the exchange_admins table (see the setup guide).');
    }
    data = await X.admin.list();
  }
  async function signIn(email, password) {
    busy = true; error = ''; render();
    try { await X.admin.signIn(email, password); who = email; await enter(); }
    catch (e) { error = e.message; data = null; }
    busy = false; render();
  }
  async function resume() {
    if (!X.admin.configured()) { render(); return; }
    try { var s = await X.admin.session(); if (s) { who = (s.user && s.user.email) || ''; await enter(); } }
    catch (e) { error = e.message; data = null; }
    render();
  }
  async function lock() { await X.admin.signOut(); data = null; who = ''; render(); }

  // Run one change against Supabase, then reload the lists.
  async function run(op, msg) {
    if (busy) return false;
    busy = true; render();
    try {
      await op();
      data = await X.admin.list();
      savedAt = new Date(); editing = null;
      toast(msg || 'Saved');
      busy = false; render(); return true;
    } catch (e) {
      busy = false;
      if (e.raw && /JWT|expired|not authenticated/i.test(e.raw.message || '')) { data = null; error = 'Your sign-in expired. Sign in again.'; }
      toast(e.message); render(); return false;
    }
  }

  // ------------------------------------------------------------------
  // Views
  // ------------------------------------------------------------------
  function gate() {
    if (!X.admin.configured()) {
      return '<div class="xa-gate"><h3>Connect Supabase</h3><p>Add your Supabase project URL and anon (publishable) key to <span class="kbd">exchange.supabaseUrl</span> and <span class="kbd">exchange.supabaseAnonKey</span> in <span class="kbd">static/config.js</span>, then run <span class="kbd">portal/supabase-exchange.sql</span> in the Supabase SQL Editor. Steps: <span class="kbd">portal/EXCHANGE_SETUP.md</span>.</p></div>';
    }
    return '<div class="xa-gate"><h3>Sign in to edit the exchange</h3><p>Lots and requirements you load here appear on the public exchange. Use the email and password of an admin login created in Supabase.</p>' +
      '<form id="xaSignIn"><div class="xa-row"><input class="xa-in" id="xaEmail" type="email" autocomplete="username" placeholder="Email" value="' + esc(who) + '" required></div>' +
      '<div class="xa-row" style="margin-top:8px"><input class="xa-in" id="xaPw" type="password" autocomplete="current-password" placeholder="Password" required><button class="btn btn-primary btn-sm" type="submit"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Signing in' : 'Sign in') + '</button></div></form>' +
      (error ? '<p class="xa-mute" style="color:#B4532A">' + esc(error) + '</p>' : '') + '</div>';
  }

  function field(name, label, value, opts) {
    opts = opts || {};
    var id = 'xaf_' + name, req = opts.req ? ' <span class="req">*</span>' : '';
    var cls = 'field' + (opts.span ? ' span-' + opts.span : '');
    var input;
    if (opts.options) {
      input = '<select id="' + id + '" name="' + name + '">' + opts.options.map(function (o) {
        var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
        return '<option value="' + esc(v) + '"' + (String(value == null ? '' : value) === String(v) ? ' selected' : '') + '>' + esc(t) + '</option>';
      }).join('') + '</select>';
    } else if (opts.textarea) {
      input = '<textarea id="' + id + '" name="' + name + '" style="min-height:70px" placeholder="' + esc(opts.ph || '') + '">' + esc(value) + '</textarea>';
    } else if (opts.check) {
      return '<div class="' + cls + '"><label for="' + id + '">' + label + '</label><label style="display:flex;gap:8px;align-items:center;font-size:14px;letter-spacing:0;text-transform:none"><input id="' + id + '" name="' + name + '" type="checkbox" style="width:auto"' + (value ? ' checked' : '') + '> ' + esc(opts.text || '') + '</label></div>';
    } else {
      input = '<input id="' + id + '" name="' + name + '" type="' + (opts.type || 'text') + '"' + (opts.type === 'number' ? ' step="any" min="0"' : '') + (opts.list ? ' list="' + opts.list + '"' : '') + ' value="' + esc(value) + '" placeholder="' + esc(opts.ph || '') + '"' + (opts.req ? ' required' : '') + '>';
    }
    return '<div class="' + cls + '"><label for="' + id + '">' + label + req + '</label>' + input + '</div>';
  }

  function lotForm() {
    var l = editing.index >= 0 ? data.lots[editing.index] : { kind: 'gpuaas', status: 'live', min_commit: 64 };
    return '<div class="sku-form" style="margin-bottom:18px"><h3 style="font-family:var(--mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--copper);margin:0 0 18px">// ' + (editing.index >= 0 ? 'Edit lot ' + esc(l.ref) : 'New lot') + '</h3>' +
      '<form id="xaLotForm"><div class="sku-form-grid">' +
      field('kind', 'Type', l.kind, { options: [['gpuaas', 'GPUaaS'], ['hardware', 'Hardware']] }) +
      field('model', 'Model', l.model, { req: 1, list: 'xaModels', ph: 'B300' }) +
      field('config', 'Configuration', l.config, { ph: 'HGX 8-GPU nodes, NVL72 racks' }) +
      field('gpu_count', 'GPUs', l.gpu_count, { req: 1, type: 'number' }) +
      field('available', 'Available', l.available, { ph: 'Immediate, Q1 2027' }) +
      field('region', 'Region', l.region, { list: 'xaRegions', ph: 'United States' }) +
      field('price', 'Price', l.price, { type: 'number', ph: 'Blank = price on request' }) +
      field('price_unit', 'Price unit', l.price_unit || (l.kind === 'hardware' ? 'per GPU' : 'per GPU-hr'), { options: ['per GPU-hr', 'per GPU', 'per node', 'per month'] }) +
      field('term_months', 'Term (months)', l.term_months, { type: 'number', ph: 'GPUaaS' }) +
      field('deposit_pct', 'Deposit %', l.deposit_pct, { type: 'number' }) +
      field('min_commit', 'Minimum order (GPUs)', l.min_commit, { type: 'number', ph: '64' }) +
      field('condition', 'Condition', l.condition, { options: [['', 'Not applicable'], 'New, sealed', 'New, open box', 'Refurbished', 'Pre-owned'] }) +
      field('status', 'Status', l.status, { options: [['live', 'Live'], ['reserved', 'Under offer'], ['hidden', 'Hidden (not on the exchange)']] }) +
      field('featured', 'Desk pick', l.featured, { check: 1, text: 'Feature at the top' }) +
      field('notes', 'Notes (public)', l.notes, { textarea: 1, span: 4, ph: 'Cooling, fabric, site tier, documentation available' }) +
      '</div><datalist id="xaModels">' + MODELS.map(function (m) { return '<option value="' + m + '">'; }).join('') + '</datalist>' +
      '<datalist id="xaRegions">' + REGIONS.map(function (m) { return '<option value="' + m + '">'; }).join('') + '</datalist>' +
      '<div style="display:flex;gap:10px;margin-top:20px;padding-top:18px;border-top:1px solid var(--line)"><button class="btn btn-primary" type="submit"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Saving' : 'Save lot') + '</button><button class="btn btn-ghost" type="button" data-xa="cancel">Cancel</button></div></form></div>';
  }

  function reqForm() {
    var r = editing.index >= 0 ? data.requirements[editing.index] : { kind: 'either', status: 'open' };
    return '<div class="sku-form" style="margin-bottom:18px"><h3 style="font-family:var(--mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--copper);margin:0 0 18px">// ' + (editing.index >= 0 ? 'Edit requirement' : 'New requirement') + '</h3>' +
      '<p class="xa-mute" style="margin:-8px 0 16px">Shown publicly on the requirements board. Never include the buyer\'s name.</p>' +
      '<form id="xaReqForm"><div class="sku-form-grid">' +
      field('kind', 'Type', r.kind, { options: [['either', 'Hardware or GPUaaS'], ['gpuaas', 'GPUaaS'], ['hardware', 'Hardware']] }) +
      field('model', 'Model', r.model, { req: 1, list: 'xaModels', ph: 'GB300' }) +
      field('gpu_count', 'GPUs', r.gpu_count, { req: 1, type: 'number' }) +
      field('region', 'Region', r.region, { list: 'xaRegions', ph: 'Any' }) +
      field('timeline', 'Timeline', r.timeline, { span: 2, ph: 'Live by Q1 2027' }) +
      field('status', 'Status', r.status, { options: [['open', 'Open (shown)'], ['closed', 'Closed (hidden)']] }) +
      '</div><datalist id="xaModels">' + MODELS.map(function (m) { return '<option value="' + m + '">'; }).join('') + '</datalist>' +
      '<datalist id="xaRegions">' + REGIONS.map(function (m) { return '<option value="' + m + '">'; }).join('') + '</datalist>' +
      '<div style="display:flex;gap:10px;margin-top:20px;padding-top:18px;border-top:1px solid var(--line)"><button class="btn btn-primary" type="submit"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Saving' : 'Save requirement') + '</button><button class="btn btn-ghost" type="button" data-xa="cancel">Cancel</button></div></form></div>';
  }

  function lotsTable() {
    var lots = data.lots || [];
    var live = lots.filter(function (l) { return l.status !== 'hidden'; });
    return '<div class="xa-panel"><div class="xa-h"><h3>Lots</h3><span class="xa-mute">' + live.length + ' on the exchange, ' + num(live.reduce(function (a, l) { return a + (l.gpu_count || 0); }, 0)) + ' GPUs' + (lots.length > live.length ? ', ' + (lots.length - live.length) + ' hidden' : '') + '</span></div>' +
      (lots.length ? '<div class="xa-scroll"><table class="xa-t"><thead><tr><th>Lot</th><th>Size</th><th>Terms</th><th>Status</th><th></th></tr></thead><tbody>' + lots.map(function (l, i) {
        var terms = l.price != null ? '$' + Number(l.price).toLocaleString('en-US', { minimumFractionDigits: /hr|hour/i.test(l.price_unit || '') ? 2 : 0, maximumFractionDigits: 2 }) + ' ' + esc(l.price_unit || '') : 'Price on request';
        return '<tr' + (l.status === 'hidden' ? ' style="opacity:.55"' : '') + '><td><b>' + esc(l.model) + '</b> ' + (l.featured ? '<span class="xa-pill priority">desk pick</span>' : '') + '<div class="xa-sub">' + esc(l.ref) + ', ' + (l.kind === 'gpuaas' ? 'GPUaaS' : 'Hardware') + (l.config ? ', ' + esc(l.config) : '') + '</div></td>' +
          '<td>' + num(l.gpu_count) + ' GPUs<div class="xa-sub">' + esc([l.region, l.available].filter(Boolean).join(', ')) + '</div></td>' +
          '<td>' + terms + '<div class="xa-sub">' + esc([l.deposit_pct ? l.deposit_pct + '% dep' : '', l.term_months ? l.term_months + ' mo' : '', 'min ' + (l.min_commit || 64)].filter(Boolean).join(', ')) + '</div></td>' +
          '<td><select class="xa-sel" data-xa-status="' + i + '"' + (busy ? ' disabled' : '') + '>' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (l.status === k ? ' selected' : '') + '>' + STATUS[k] + '</option>'; }).join('') + '</select></td>' +
          '<td class="xa-btns"><button class="btn btn-ghost btn-sm" data-xa="edit-lot" data-i="' + i + '">Edit</button><button class="btn btn-ghost btn-sm" data-xa="feature" data-i="' + i + '">' + (l.featured ? 'Unfeature' : 'Desk pick') + '</button><button class="btn btn-ghost btn-sm" data-xa="copy" data-i="' + i + '">Copy link</button><button class="btn btn-ghost btn-sm" data-xa="del-lot" data-i="' + i + '">Delete</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="xa-mute" style="padding:16px 0">No lots yet. Add one, or import a CSV.</p>') + '</div>';
  }

  function reqTable() {
    var reqs = data.requirements || [];
    return '<div class="xa-panel" style="margin-top:18px"><div class="xa-h"><h3>Open requirements</h3><span class="xa-mute">Public requirements board. ' + reqs.filter(function (r) { return r.status === 'open'; }).length + ' shown.</span></div>' +
      (reqs.length ? '<div class="xa-scroll"><table class="xa-t"><thead><tr><th>Model</th><th>GPUs</th><th>Region</th><th>Timeline</th><th>Status</th><th></th></tr></thead><tbody>' + reqs.map(function (r, i) {
        return '<tr' + (r.status !== 'open' ? ' style="opacity:.55"' : '') + '><td><b>' + esc(r.model) + '</b><div class="xa-sub">' + (r.kind === 'gpuaas' ? 'GPUaaS' : r.kind === 'hardware' ? 'Hardware' : 'Hardware or GPUaaS') + '</div></td><td>' + num(r.gpu_count) + '</td><td>' + esc(r.region || 'Any') + '</td><td>' + esc(r.timeline || '') + '</td><td>' + (r.status === 'open' ? 'Open' : 'Closed') + '</td>' +
          '<td class="xa-btns"><button class="btn btn-ghost btn-sm" data-xa="edit-req" data-i="' + i + '">Edit</button><button class="btn btn-ghost btn-sm" data-xa="toggle-req" data-i="' + i + '">' + (r.status === 'open' ? 'Close' : 'Reopen') + '</button><button class="btn btn-ghost btn-sm" data-xa="del-req" data-i="' + i + '">Delete</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="xa-mute" style="padding:16px 0">No requirements posted.</p>') + '</div>';
  }

  function render() {
    var m = mount(); if (!m) return;
    if (!data) { m.innerHTML = gate(); if (!busy) { var f = m.querySelector(who ? '#xaPw' : '#xaEmail'); if (f) f.focus(); } return; }
    var c = document.getElementById('tabc-exchange'); if (c) c.textContent = (data.lots || []).filter(function (l) { return l.status !== 'hidden'; }).length;
    m.innerHTML =
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px"><button class="btn btn-primary btn-sm" data-xa="add-lot">Add lot</button><button class="btn btn-ghost btn-sm" data-xa="add-req">Add requirement</button>' +
      '<label class="btn btn-ghost btn-sm" style="cursor:pointer">Import CSV<input type="file" accept=".csv,text/csv" id="xaCsv" style="display:none"></label>' +
      '<span class="xa-mode">' + (busy ? 'Saving' : savedAt ? 'Saved ' + savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Signed in') +
      ' &middot; ' + esc(who) + ' &middot; <a href="#" data-xa="lock">Sign out</a></span></div>' +
      (editing ? (editing.type === 'lot' ? lotForm() : reqForm()) : '') +
      lotsTable() + reqTable();
  }

  // ------------------------------------------------------------------
  // CSV import: header row + one lot per row (same columns as the form,
  // case-insensitive; Quantity / Form Factor / Lead Text also work).
  // ------------------------------------------------------------------
  function parseCSV(text) {
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    rows = rows.filter(function (r) { return r.some(function (v) { return String(v).trim() !== ''; }); });
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return String(h).trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); });
    return rows.slice(1).map(function (r) { var o = {}; head.forEach(function (h, j) { o[h] = String(r[j] == null ? '' : r[j]).trim(); }); return o; });
  }
  function col(o, names) { for (var i = 0; i < names.length; i++) { if (o[names[i]]) return o[names[i]]; } return ''; }
  function n(v) { v = String(v || '').replace(/[$,%\s]/g, ''); if (v === '') return null; var x = Number(v); return isFinite(x) ? x : null; }
  function lotFromRow(o) {
    var model = col(o, ['model', 'gpu']), gpus = n(col(o, ['gpus', 'gpu count', 'quantity', 'qty']));
    if (!model || !gpus) return null;
    var t = col(o, ['type', 'kind']), kind = /aas|cloud|capacity|hr|hour/i.test(t) ? 'gpuaas' : 'hardware';
    var st = col(o, ['status']).toLowerCase();
    var days = n(col(o, ['lead days']));
    return {
      ref: col(o, ['ref', 'lot', 'reference']), kind: kind, model: model,
      config: col(o, ['config', 'configuration', 'form factor']) || null, gpu_count: gpus,
      condition: col(o, ['condition']) || null, region: col(o, ['region', 'location']) || null,
      available: col(o, ['available', 'availability', 'lead text', 'timing']) || (days != null ? (days === 0 ? 'Immediate' : days + ' days') : null),
      price: n(col(o, ['price', 'rate'])), price_unit: col(o, ['price unit', 'unit']) || (kind === 'gpuaas' ? 'per GPU-hr' : 'per GPU'),
      term_months: n(col(o, ['term months', 'term'])), deposit_pct: n(col(o, ['deposit', 'deposit pct'])),
      min_commit: n(col(o, ['min order', 'minimum order', 'min commit', 'minimum'])),
      featured: /^(y|yes|true|1|x)$/i.test(col(o, ['featured', 'desk pick'])),
      status: /^(hidden|hide|draft|closed|sold|inactive|off|no)$/.test(st) ? 'hidden' : /offer|reserv/.test(st) ? 'reserved' : 'live',
      notes: col(o, ['notes', 'description']) || null,
    };
  }
  async function importCsv(file) {
    var rows = parseCSV(await file.text()).map(lotFromRow).filter(Boolean);
    if (!rows.length) { toast('No lots found. The first row must be headers, with at least Model and GPUs (or Quantity).'); return; }
    var noRef = rows.filter(function (r) { return !r.ref; }).length;
    if (!confirm('Import ' + rows.length + ' lot' + (rows.length === 1 ? '' : 's') + ' from ' + file.name + '?\n\nRows with a Ref that already exists update that lot.' +
      (noRef ? '\n' + noRef + ' row' + (noRef === 1 ? ' has' : 's have') + ' no Ref, so ' + (noRef === 1 ? 'it is' : 'they are') + ' added as new lots. Importing the same file again would add ' + (noRef === 1 ? 'it' : 'them') + ' twice; add a Ref column to update instead.' : ''))) return;
    var made = [];
    rows.forEach(function (r) { if (!r.ref) { r.ref = nextRef(r.model, made); } made.push(r); });
    await run(function () { return X.admin.importLots(rows); }, rows.length + ' lot' + (rows.length === 1 ? '' : 's') + ' imported');
  }

  // ------------------------------------------------------------------
  // Events
  // ------------------------------------------------------------------
  function formValues(f) {
    var fd = new FormData(f), o = {};
    fd.forEach(function (v, k) { o[k] = String(v).trim(); });
    ['gpu_count', 'price', 'term_months', 'deposit_pct', 'min_commit'].forEach(function (k) { if (k in o) o[k] = n(o[k]); });
    if (f.querySelector('[name=featured]')) o.featured = f.querySelector('[name=featured]').checked;
    Object.keys(o).forEach(function (k) { if (o[k] === '') o[k] = null; });
    return o;
  }

  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!mount() || !mount().contains(f)) return;
    e.preventDefault();
    if (f.id === 'xaSignIn') { var em = f.querySelector('#xaEmail').value.trim(), p = f.querySelector('#xaPw').value; if (em && p) signIn(em, p); return; }
    var v = formValues(f);
    if (!v.model || !v.gpu_count) { toast('Model and GPUs are required'); return; }
    var i = editing.index;
    if (f.id === 'xaLotForm') {
      var lot = i >= 0 ? Object.assign({}, data.lots[i], v) : Object.assign(v, { ref: nextRef(v.model) });
      run(function () { return X.admin.saveLot(lot); }, i >= 0 ? 'Lot updated' : 'Lot added');
    } else if (f.id === 'xaReqForm') {
      var req = i >= 0 ? Object.assign({}, data.requirements[i], v) : v;
      run(function () { return X.admin.saveReq(req); }, i >= 0 ? 'Requirement updated' : 'Requirement added');
    }
  });

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-xa]');
    if (!t || !mount() || !mount().contains(t)) return;
    e.preventDefault();
    var a = t.dataset.xa, i = +t.dataset.i;
    if (a === 'lock') return lock();
    if (a === 'cancel') { editing = null; return render(); }
    if (a === 'add-lot') { editing = { type: 'lot', index: -1 }; render(); return window.scrollTo({ top: mount().getBoundingClientRect().top + scrollY - 90, behavior: 'smooth' }); }
    if (a === 'add-req') { editing = { type: 'req', index: -1 }; render(); return; }
    if (a === 'edit-lot') { editing = { type: 'lot', index: i }; render(); return window.scrollTo({ top: mount().getBoundingClientRect().top + scrollY - 90, behavior: 'smooth' }); }
    if (a === 'edit-req') { editing = { type: 'req', index: i }; return render(); }
    if (a === 'feature') { var fl = data.lots[i]; return run(function () { return X.admin.saveLot({ id: fl.id, featured: !fl.featured }); }, fl.featured ? 'Removed desk pick' : 'Marked as desk pick'); }
    if (a === 'copy') { var ref = data.lots[i].ref; return navigator.clipboard.writeText(base() + '#lot=' + encodeURIComponent(ref)).then(function () { toast('Lot link copied'); }, function () { toast(base() + '#lot=' + ref); }); }
    if (a === 'del-lot') { if (confirm('Delete lot ' + data.lots[i].ref + ' (' + data.lots[i].model + ')? To take it off the exchange but keep it, set it to Hidden instead.')) { var dl = data.lots[i]; run(function () { return X.admin.deleteLot(dl.id); }, 'Lot deleted'); } return; }
    if (a === 'toggle-req') { var tr = data.requirements[i]; return run(function () { return X.admin.saveReq({ id: tr.id, status: tr.status === 'open' ? 'closed' : 'open' }); }, 'Requirement updated'); }
    if (a === 'del-req') { if (confirm('Delete this requirement?')) { var dr = data.requirements[i]; run(function () { return X.admin.deleteReq(dr.id); }, 'Requirement deleted'); } }
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!mount() || !mount().contains(t)) return;
    if (t.id === 'xaCsv' && t.files && t.files[0]) { importCsv(t.files[0]); t.value = ''; return; }
    if (t.dataset.xaStatus != null) { var si = +t.dataset.xaStatus, v = t.value, sl = data.lots[si]; run(function () { return X.admin.saveLot({ id: sl.id, status: v }); }, 'Lot ' + (STATUS[v] || v).toLowerCase()); }
  });

  window.TCNExchangeAdmin = { render: render };
  resume();
})();
