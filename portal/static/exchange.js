// The Chief Negotiators Exchange — public UI (no accounts, no sign-in)
// Every path through this page ends at one of two outcomes:
//   1. a booked allocation call, or
//   2. a phone number the desk can call inside the hour.
(function () {
  'use strict';

  var X = window.TCNX;
  var CFG = window.TCN_CONFIG || {};
  var CONTACT = CFG.contact || {};
  var BOOK = X.bookingLink;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var num = function (n) { return n == null || n === '' ? '' : Number(n).toLocaleString('en-US'); };

  var state = { floor: [], kind: 'all', model: '', region: '', loaded: false };

  // ------------------------------------------------------------------
  // Engraved band: a guilloche pattern drawn once as SVG
  // ------------------------------------------------------------------
  (function guilloche() {
    var w = 420, h = 64, paths = [];
    for (var k = 0; k < 9; k++) {
      var d = '', amp = 9 + k * 1.6, ph = k * 0.55, f = 2 * Math.PI / (w / 3);
      for (var x = 0; x <= w; x += 4) {
        var y = h / 2 + amp * Math.sin(x * f + ph) * Math.cos(x * f / 3 - ph);
        d += (x ? 'L' : 'M') + x + ' ' + y.toFixed(2);
      }
      paths.push('<path d="' + d + '"/>');
    }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"><g fill="none" stroke="#CFA164" stroke-opacity=".12" stroke-width=".7">' + paths.join('') + '</g></svg>';
    document.documentElement.style.setProperty('--guilloche', 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")');
  })();

  // ------------------------------------------------------------------
  // Formatting
  // ------------------------------------------------------------------
  function lotNo(l) { var m = String(l.ref || '').match(/(\d+)$/); return m ? m[1] : String(l.ref || '—'); }
  function money(v, unit) {
    if (v == null) return '';
    var hourly = /hr|hour/i.test(unit || '');
    return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: hourly ? 2 : 0, maximumFractionDigits: 2 });
  }
  function kindName(k) { return k === 'gpuaas' ? 'GPUaaS' : k === 'hardware' ? 'Hardware' : 'Hardware or GPUaaS'; }

  function toast(msg) { var t = $('#xToast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 2800); }
  function bookBtn(label, cls) { return BOOK ? '<a class="x-btn ' + (cls || '') + '" href="' + esc(BOOK) + '" target="_blank" rel="noopener" data-act="booked">' + esc(label) + '</a>' : ''; }

  // Contact details are remembered in this browser so repeat enquiries are one click.
  var CKEY = 'tcnx_contact_v1';
  function savedContact() { try { return JSON.parse(localStorage.getItem(CKEY)) || {}; } catch (e) { return {}; } }
  function saveContact(c) { try { localStorage.setItem(CKEY, JSON.stringify(c)); } catch (e) {} }
  function contactFields(prefix) {
    var c = savedContact();
    var f = function (n, l, t, ac) { return '<div class="x-field"><label for="' + prefix + n + '">' + l + ' <i>*</i></label><input class="x-in" id="' + prefix + n + '" name="' + n + '" type="' + t + '" autocomplete="' + ac + '" value="' + esc(c[n] || '') + '"></div>'; };
    return f('name', 'Full name', 'text', 'name') + f('company', 'Company', 'text', 'organization') + f('email', 'Work email', 'email', 'email') + f('phone', 'Best number for the desk', 'tel', 'tel');
  }
  // Validates the contact block; returns the contact or null (and marks the form).
  function readContact(form, fd) {
    var c = {}, miss = [];
    ['name', 'company', 'email', 'phone'].forEach(function (k) { c[k] = String(fd.get(k) || '').trim(); if (!c[k]) miss.push(k); });
    if (c.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email) && miss.indexOf('email') < 0) miss.push('email');
    form.querySelectorAll('.bad').forEach(function (x) { x.classList.remove('bad'); });
    if (miss.length) {
      miss.forEach(function (k) { form.querySelector('[name=' + k + ']').classList.add('bad'); });
      form.querySelector('[data-err]').textContent = miss.length === 1 ? 'One field still needed' : miss.length + ' fields still needed';
      form.querySelector('.bad').focus();
      return null;
    }
    saveContact(c);
    return c;
  }
  async function send(form, subject, fields, label) {
    var btn = form.querySelector('[type=submit]'), err = form.querySelector('[data-err]');
    btn.disabled = true; btn.textContent = 'Sending';
    var ok = await X.notify(subject, Object.assign({ Page: location.href }, fields));
    if (!ok) {
      err.innerHTML = 'Could not send. Email <a href="mailto:' + esc(CONTACT.email || '') + '">' + esc(CONTACT.email || 'the desk') + '</a> or call ' + esc(CONTACT.phone || 'us') + '.';
      btn.disabled = false; btn.textContent = label;
    }
    return ok;
  }

  // ------------------------------------------------------------------
  // Header, hero, footer
  // ------------------------------------------------------------------
  function renderChrome() {
    $('#xAcct').innerHTML = bookBtn('Book a call', 'sm');
    $('#xHeroCta').innerHTML = '<a class="x-btn" href="#floor">Browse the floor</a><button class="x-btn ghost" data-act="require">Post a requirement</button>';
    $('#xSellCta').innerHTML = '<button class="x-btn" data-act="sublot">Submit a lot</button>' + bookBtn('Talk to the desk first', 'ghost');
    $('#xFootContact').innerHTML =
      (CONTACT.phone ? '<a href="tel:' + esc(CONTACT.phoneHref || CONTACT.phone) + '">' + esc(CONTACT.phone) + '</a>' : '') +
      (CONTACT.email ? '<a href="mailto:' + esc(CONTACT.email) + '">' + esc(CONTACT.email) + '</a>' : '') +
      (BOOK ? '<a href="' + esc(BOOK) + '" target="_blank" rel="noopener">Book an allocation call</a>' : '');
    $('#xYear').textContent = new Date().getFullYear();
  }

  // ------------------------------------------------------------------
  // The tape (hero ledger)
  // ------------------------------------------------------------------
  function renderTape() {
    var el = $('#xTape'), f = state.floor;
    if (!state.loaded) { el.innerHTML = '<div class="x-tape-h"><span>On the floor now</span></div>'; return; }
    var open = f.filter(function (l) { return l.status === 'live'; });
    var gpus = open.reduce(function (a, l) { return a + (l.gpu_count || 0); }, 0);
    var rows = f.slice(0, 6).map(function (l) {
      return '<button class="x-tape-row" data-act="lot" data-id="' + esc(l.id) + '"><span class="n">Lot ' + esc(lotNo(l)) + '</span><span class="m">' + esc(l.model) + '<small>' + esc(kindName(l.kind)) + '</small></span><span class="q">' + num(l.gpu_count) + ' GPUs</span><span class="w">' + esc(l.status === 'reserved' ? 'Under offer' : l.available || '') + '</span></button>';
    }).join('');
    el.innerHTML = '<div class="x-tape-h"><span class="x-live"><i></i>On the floor now</span><span><b>' + open.length + '</b> open lots</span></div>' +
      (rows || '<div class="x-tape-row"><span></span><span class="m">The floor opens shortly</span></div>') +
      '<div class="x-tape-f"><span>' + num(gpus) + ' GPUs available</span><a href="#floor">See every lot</a></div>';
  }

  // ------------------------------------------------------------------
  // The floor
  // ------------------------------------------------------------------
  function termsHtml(l) {
    if (l.price != null) {
      var sub = [l.deposit_pct ? l.deposit_pct + '% deposit' : '', l.term_months ? l.term_months + '-month term' : ''].filter(Boolean).join(', ');
      return '<span class="p">' + money(l.price, l.price_unit) + '<small>' + esc(l.price_unit || '') + '</small></span><span class="s">' + esc(sub || 'Min ' + num(l.min_commit || 64) + ' GPUs') + '</span>';
    }
    return '<span class="p" style="font-size:19px">Price on request</span><span class="s">Min ' + num(l.min_commit || 64) + ' GPUs</span>';
  }

  function lotCard(l) {
    var tag = l.status === 'reserved' ? '<span class="x-tag res">Under offer</span>' : l.featured ? '<span class="x-tag feat">Desk pick</span>' : '<span class="x-tag">' + kindName(l.kind) + '</span>';
    var facts = [
      ['GPUs', num(l.gpu_count)],
      ['Available', l.available || 'On request'],
      ['Region', l.region || 'On request'],
      l.kind === 'gpuaas' ? ['Term', l.term_months ? l.term_months + ' months' : 'Flexible'] : ['Condition', l.condition || 'On request'],
    ];
    return '<button class="x-lot" data-act="lot" data-id="' + esc(l.id) + '" aria-label="Lot ' + esc(lotNo(l)) + ', ' + esc(l.model) + '">' +
      '<div class="x-band"><span class="x-lotno">Lot ' + esc(lotNo(l)) + '</span>' + tag + '</div>' +
      '<div class="x-lot-body"><h3>' + esc(l.model) + '<small>' + esc([l.config, kindName(l.kind)].filter(Boolean).join(', ')) + '</small></h3>' +
      '<dl class="x-facts">' + facts.map(function (f) { return '<div><dt>' + f[0] + '</dt><dd>' + esc(f[1]) + '</dd></div>'; }).join('') + '</dl>' +
      '<div class="x-terms">' + termsHtml(l) + '</div></div></button>';
  }

  function renderFloor() {
    var mount = $('#xLots');
    if (!state.loaded) return;
    if (state.error && !state.floor.length) {
      mount.innerHTML = '<div class="x-gate" style="grid-column:1/-1"><h3>The floor is refreshing.</h3><p>Try again in a minute, or tell the desk what you need and we will send matching lots.</p><button class="x-btn" data-act="require">Post a requirement</button></div>';
      return;
    }
    var models = {}, regions = {};
    state.floor.forEach(function (l) { models[l.model] = 1; if (l.region) regions[l.region] = 1; });
    fillSelect($('#xModel'), 'Every model', Object.keys(models), state.model);
    fillSelect($('#xRegion'), 'Every region', Object.keys(regions), state.region);
    var shown = state.floor.filter(function (l) {
      return (state.kind === 'all' || l.kind === state.kind) && (!state.model || l.model === state.model) && (!state.region || l.region === state.region);
    });
    $('#xCount').textContent = shown.length + (shown.length === 1 ? ' lot' : ' lots') + ', ' + num(shown.reduce(function (a, l) { return a + (l.gpu_count || 0); }, 0)) + ' GPUs';
    mount.innerHTML = shown.length ? shown.map(lotCard).join('') :
      '<div class="x-gate" style="grid-column:1/-1"><h3>' + (state.floor.length ? 'Nothing on the floor matches that yet.' : 'New lots are being added.') + '</h3><p>Most allocation is placed before it is ever listed. Tell us what you need and the desk will source it.</p>' +
      '<button class="x-btn" data-act="require">Post a requirement</button></div>';
  }
  function fillSelect(sel, first, vals, cur) {
    var html = '<option value="">' + first + '</option>' + vals.sort().map(function (v) { return '<option' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('');
    if (sel.innerHTML !== html) sel.innerHTML = html;
  }

  // ------------------------------------------------------------------
  // Demand board
  // ------------------------------------------------------------------
  async function renderDemand() {
    var mount = $('#xDemand');
    $('#xDemandCta').innerHTML = '<button class="x-btn ghost" data-act="require">Post a requirement</button>';
    var rows = [];
    try { rows = await X.demand(); } catch (e) { rows = state.demand || []; }
    mount.innerHTML = rows.length ? '<div class="x-demand">' + rows.map(function (r) {
      return '<div class="x-dem-row"><span class="m">' + esc(r.model) + ' <span class="d" style="font:13px var(--sans)">' + esc(kindName(r.kind)) + '</span></span><span>' + num(r.gpu_count) + ' GPUs</span><span class="d">' + esc(r.region || 'Any region') + '</span><span class="d">' + esc(r.timeline || '') + '</span><button class="x-btn ghost sm" data-act="fill" data-id="' + esc(r.id) + '">Offer to fill</button></div>';
    }).join('') + '</div>' : '<p class="x-empty">No open requirements listed right now. Post yours and the desk will start sourcing.</p>';
    state.demand = rows;
  }

  // ------------------------------------------------------------------
  // Panels
  // ------------------------------------------------------------------
  var openPanel = null;
  function panel(html, opts) {
    closePanel(true);
    opts = opts || {};
    var scrim = document.createElement('div'); scrim.className = 'x-scrim';
    var p = document.createElement('div'); p.className = 'x-panel' + (opts.center ? ' center' : '');
    p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true');
    p.innerHTML = '<button class="x-close" data-act="close" aria-label="Close">&times;</button><div class="x-panel-in">' + html + '</div>';
    document.body.appendChild(scrim); document.body.appendChild(p);
    requestAnimationFrame(function () { scrim.classList.add('on'); p.classList.add('on'); });
    scrim.addEventListener('click', function () { closePanel(); });
    openPanel = { p: p, scrim: scrim, prev: document.activeElement };
    var f = p.querySelector('input:not([type=radio]):not([type=checkbox]), select, textarea, .x-btn');
    document.documentElement.classList.add('x-lock');
    setTimeout(function () { (f || p.querySelector('.x-close')).focus({ preventScroll: true }); }, 60);
    return p;
  }
  function closePanel(instant) {
    if (!openPanel) return;
    var o = openPanel; openPanel = null;
    if (!instant) document.documentElement.classList.remove('x-lock');
    o.p.classList.remove('on'); o.scrim.classList.remove('on');
    setTimeout(function () { o.p.remove(); o.scrim.remove(); }, instant ? 0 : 320);
    if (!instant && o.prev && o.prev.focus) o.prev.focus({ preventScroll: true });
    if (/^#(lot=|require|sell)/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  }
  function setPanel(html) { if (openPanel) openPanel.p.querySelector('.x-panel-in').innerHTML = html; }
  function actions(label) { return '<div class="full x-actions" style="border:0;padding:0;margin:4px 0 0"><span class="x-err" data-err></span><button class="x-btn" type="submit">' + label + '</button></div>'; }
  function doneCallout(h4, p) { return '<div class="x-callout"><h4>' + h4 + '</h4><p>' + p + '</p>' + bookBtn('Book the call now', 'block') + '</div>'; }

  // ---- Lot detail ----
  function openLot(id) {
    var l = state.floor.filter(function (x) { return x.id === id || x.ref === id; })[0];
    if (!l) return;
    history.replaceState(null, '', location.pathname + location.search + '#lot=' + encodeURIComponent(l.ref));
    var facts = [
      ['GPUs', num(l.gpu_count)], ['Configuration', l.config || 'On request'],
      ['Available', l.available || 'On request'], ['Region', l.region || 'On request'],
      [l.kind === 'gpuaas' ? 'Term' : 'Condition', l.kind === 'gpuaas' ? (l.term_months ? l.term_months + ' months' : 'Flexible') : (l.condition || 'On request')],
      ['Minimum order', num(l.min_commit || 64) + ' GPUs'],
      ['Price', l.price != null ? money(l.price, l.price_unit) + ' ' + (l.price_unit || '') : 'On request'],
      ['Deposit', l.deposit_pct ? l.deposit_pct + '%' : 'Negotiable'],
    ];
    var reserved = l.status === 'reserved';
    var label = reserved ? 'Take the backup position' : 'Request introduction';
    panel('<div class="x-detail-band"><div class="x-kicker">Lot ' + esc(lotNo(l)) + ', ' + esc(kindName(l.kind)) + (reserved ? ', under offer' : '') + '</div><h2>' + esc(l.model) + '</h2><div style="color:var(--smoke);font-size:13px">Reference ' + esc(l.ref) + '</div></div>' +
      '<dl class="x-detail-facts">' + facts.map(function (f) { return '<div><dt>' + f[0] + '</dt><dd>' + esc(f[1]) + '</dd></div>'; }).join('') + '</dl>' +
      (l.notes ? '<p style="color:var(--smoke);margin:18px 0 0">' + esc(l.notes) + '</p>' : '') +
      '<div class="x-callout quiet"><h4>' + label + '</h4><p>' + (reserved ? 'This lot is under offer. Backup positions are called in order if the current deal does not close.' : 'The desk confirms allocation with the seller, runs the NCNDA and sets up the call. Sellers do not see your name until you both agree to proceed.') + '</p>' +
      '<form class="x-form" data-form="intro" data-ref="' + esc(l.ref) + '" data-model="' + esc(l.model) + '">' +
      '<div class="x-field"><label for="iq">GPUs needed <i>*</i></label><input class="x-in" id="iq" name="gpu_count" type="number" min="1" max="' + esc(l.gpu_count) + '" value="' + esc(Math.min(l.gpu_count, Math.max(l.min_commit || 64, 64))) + '" required></div>' +
      '<div class="x-field"><label for="it">Timeline <i>*</i></label><select class="x-in" id="it" name="timeline"><option>Ready to commit now</option><option>This quarter</option><option>Next quarter</option><option>Exploring</option></select></div>' +
      contactFields('i_') +
      '<div class="x-field full"><label for="im">Anything the desk should know</label><textarea class="x-in" id="im" name="message" placeholder="Term, ramp schedule, delivery site, financing"></textarea></div>' +
      actions(label) + '</form></div>');
  }

  async function submitIntro(form) {
    var fd = new FormData(form), c = readContact(form, fd); if (!c) return;
    var supply = form.dataset.dir === 'supply';
    var body = { GPUs: +fd.get('gpu_count') || '', Timeline: fd.get('timeline'), Message: String(fd.get('message') || '').trim() || '—' };
    var what = supply ? 'offer to fill ' + form.dataset.model + ' requirement' : 'lot ' + form.dataset.ref + ' (' + form.dataset.model + ')';
    var ok = await send(form, '[INTRO · CALL NOW] ' + c.company + ' — ' + what, Object.assign({ Name: c.name, Company: c.company, Email: c.email, Phone: c.phone, Direction: supply ? 'supply' : 'buy', Lot: form.dataset.ref || '—', Requirement: supply ? form.dataset.model : '—' }, body), supply ? 'Offer to fill' : 'Request introduction');
    if (!ok) return;
    setPanel('<div class="x-kicker">' + (supply ? 'Requirement' : 'Lot ' + esc(lotNo({ ref: form.dataset.ref }))) + '</div><h2>Introduction requested.</h2><p class="sub">The desk is confirming allocation with the ' + (supply ? 'buyer' : 'seller') + ' now.</p>' +
      doneCallout('Lock in your call while this is fresh.', 'Lots move to the buyers who are ready to talk. A 20-minute call is how we hold this one for you.') +
      '<p style="color:var(--smoke);font-size:14px">Prefer a call back? We will ring ' + esc(c.phone) + ' within one business hour.</p>');
  }

  // ---- Seller: submit a lot ----
  function openSubmitLot() {
    var sel = function (n, l, opts, req) { return '<div class="x-field"><label for="s_' + n + '">' + l + (req ? ' <i>*</i>' : '') + '</label><select class="x-in" id="s_' + n + '" name="' + n + '">' + opts.map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select></div>'; };
    var inp = function (n, l, t, ph, req) { return '<div class="x-field"><label for="s_' + n + '">' + l + (req ? ' <i>*</i>' : '') + '</label><input class="x-in" id="s_' + n + '" name="' + n + '" type="' + (t || 'text') + '"' + (ph ? ' placeholder="' + ph + '"' : '') + (t === 'number' ? ' step="any" min="0"' : '') + '></div>'; };
    panel('<h2>Submit a lot</h2><p class="sub">The desk reviews every lot before it reaches the floor, usually the same business day. Your company name is never shown on the floor.</p>' +
      '<form data-form="sublot"><div class="x-form">' +
      sel('kind', 'Type', ['GPUaaS', 'Hardware'], 1) + sel('model', 'Model', ['Vera Rubin', 'GB300', 'B300', 'GB200', 'B200', 'H200', 'H100', 'Other'], 1) +
      inp('config', 'Configuration', 'text', 'HGX 8-GPU, NVL72') + inp('gpu_count', 'GPUs', 'number', '', 1) +
      inp('available', 'Available', 'text', 'Immediate, Q1 2027', 1) + sel('region', 'Region', ['United States', 'Canada', 'EU', 'UK', 'Other'], 1) +
      inp('price', 'Asking price', 'number', 'Leave blank for price on request') + sel('price_unit', 'Price unit', ['per GPU-hr', 'per GPU', 'per node']) +
      inp('term_months', 'Term (months)', 'number', 'GPUaaS only') + inp('deposit_pct', 'Deposit %', 'number', '') +
      inp('min_commit', 'Minimum order (GPUs)', 'number', '64') + sel('condition', 'Condition', ['Not applicable', 'New, sealed', 'New, open box', 'Refurbished', 'Pre-owned']) +
      '<div class="x-field full"><label for="s_notes">Notes</label><textarea class="x-in" id="s_notes" name="notes" placeholder="Cooling, fabric, site tier, documentation available"></textarea></div>' +
      contactFields('s_c_') +
      '</div><div class="x-actions"><span class="x-err" data-err></span><button class="x-btn" type="submit">Submit for review</button></div></form>', { center: true });
  }
  async function submitLot(form) {
    var fd = new FormData(form), err = form.querySelector('[data-err]');
    var g = function (k) { return String(fd.get(k) || '').trim(); };
    if (!g('gpu_count') || !g('available')) { err.textContent = 'GPUs and availability are required'; return; }
    var c = readContact(form, fd); if (!c) return;
    var lot = { Type: g('kind'), Model: g('model'), Configuration: g('config') || '—', GPUs: g('gpu_count'), Available: g('available'), Region: g('region'),
      Price: g('price') ? g('price') + ' ' + g('price_unit') : 'On request', 'Term months': g('term_months') || '—', 'Deposit %': g('deposit_pct') || '—',
      'Min order': g('min_commit') || '64', Condition: g('condition'), Notes: g('notes') || '—' };
    var ok = await send(form, '[NEW LOT · REVIEW] ' + c.company + ' — ' + lot.GPUs + ' ' + lot.Model, Object.assign({ Seller: c.company, Contact: c.name, Email: c.email, Phone: c.phone }, lot), 'Submit for review');
    if (!ok) return;
    setPanel('<div class="x-kicker">Submitted</div><h2>Lot submitted for review.</h2><p class="sub">The desk will verify allocation before it goes live.</p>' +
      doneCallout('Go live faster.', 'A short call lets us confirm documents and pricing strategy in one pass.'));
  }

  // ---- Buyer: post a requirement ----
  function openRequirement() {
    panel('<h2>Post a requirement</h2><p class="sub">Tell the desk what you need. Sellers see the model, volume, region and timing, never your name.</p>' +
      '<form data-form="require"><div class="x-form">' +
      '<div class="x-field"><label for="r_kind">Type</label><select class="x-in" id="r_kind" name="kind"><option value="either">Hardware or GPUaaS</option><option value="hardware">Hardware</option><option value="gpuaas">GPUaaS</option></select></div>' +
      '<div class="x-field"><label for="r_model">Model <i>*</i></label><select class="x-in" id="r_model" name="model"><option>B300</option><option>GB300</option><option>Vera Rubin</option><option>B200</option><option>H200</option><option>H100</option><option>Open to options</option></select></div>' +
      '<div class="x-field"><label for="r_gpus">GPUs <i>*</i></label><input class="x-in" id="r_gpus" name="gpu_count" type="number" min="1"></div>' +
      '<div class="x-field"><label for="r_region">Region</label><select class="x-in" id="r_region" name="region"><option>United States</option><option>Canada</option><option>EU</option><option>UK</option><option>Any</option></select></div>' +
      '<div class="x-field"><label for="r_tl">Timeline</label><input class="x-in" id="r_tl" name="timeline" placeholder="Live by Q1 2027"></div>' +
      '<div class="x-field"><label for="r_budget">Budget</label><input class="x-in" id="r_budget" name="budget" placeholder="Seen by the desk only"></div>' +
      contactFields('r_c_') +
      '<div class="x-field full"><label for="r_notes">Notes for the desk</label><textarea class="x-in" id="r_notes" name="notes"></textarea></div>' +
      '</div><div class="x-actions"><span class="x-err" data-err></span><button class="x-btn" type="submit">Post requirement</button></div></form>', { center: true });
  }
  async function submitRequirement(form) {
    var fd = new FormData(form), err = form.querySelector('[data-err]');
    var g = function (k) { return String(fd.get(k) || '').trim(); };
    if (!(+g('gpu_count'))) { err.textContent = 'Add a GPU count'; form.querySelector('[name=gpu_count]').classList.add('bad'); return; }
    var c = readContact(form, fd); if (!c) return;
    var r = { Type: kindName(g('kind')), Model: g('model'), GPUs: g('gpu_count'), Region: g('region'), Timeline: g('timeline') || '—', Budget: g('budget') || '—', Notes: g('notes') || '—' };
    var ok = await send(form, '[REQUIREMENT · CALL NOW] ' + c.company + ' — ' + r.GPUs + ' ' + r.Model, Object.assign({ Buyer: c.company, Contact: c.name, Email: c.email, Phone: c.phone }, r), 'Post requirement');
    if (!ok) return;
    setPanel('<h2>Requirement received.</h2><p class="sub">The desk is checking listed lots and allocation that has not been listed yet, which is where most fills come from.</p>' +
      doneCallout('Fastest path to a fill', 'Ten minutes on the phone lets us shop this off-market today.'));
  }

  // ---- Seller: offer to fill a requirement ----
  function openFill(id) {
    var r = (state.demand || []).filter(function (x) { return x.id === id; })[0]; if (!r) return;
    var label = num(r.gpu_count) + ' ' + r.model;
    panel('<div class="x-kicker">Open requirement</div><h2>' + esc(label) + '</h2><p class="sub">' + esc([kindName(r.kind), r.region, r.timeline].filter(Boolean).join(', ')) + '</p>' +
      '<form class="x-form" data-form="intro" data-dir="supply" data-model="' + esc(label + (r.region ? ', ' + r.region : '')) + '">' +
      '<div class="x-field"><label for="fq">GPUs you can supply <i>*</i></label><input class="x-in" id="fq" name="gpu_count" type="number" min="1" value="' + esc(r.gpu_count) + '" required></div>' +
      '<div class="x-field"><label for="ft">Availability <i>*</i></label><select class="x-in" id="ft" name="timeline"><option>Within 30 days</option><option>This quarter</option><option>Next quarter</option><option>Later</option></select></div>' +
      contactFields('f_') +
      '<div class="x-field full"><label for="fm">Configuration, pricing guidance, documents</label><textarea class="x-in" id="fm" name="message"></textarea></div>' +
      actions('Offer to fill') + '</form>');
  }

  // ------------------------------------------------------------------
  // Events
  // ------------------------------------------------------------------
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act], [data-kind]');
    if (!t) return;
    if (t.dataset.kind) {
      state.kind = t.dataset.kind;
      document.querySelectorAll('[data-kind]').forEach(function (b) { b.classList.toggle('on', b === t); });
      renderFloor(); return;
    }
    var a = t.dataset.act;
    if (a === 'booked') { X.notify('[CALL LINK CLICKED] ' + (savedContact().company || 'visitor'), { Who: savedContact().email || 'unknown', Page: location.href }); return; }
    e.preventDefault();
    if (a === 'close') closePanel();
    else if (a === 'lot') openLot(t.dataset.id);
    else if (a === 'sublot') openSubmitLot();
    else if (a === 'require') openRequirement();
    else if (a === 'fill') openFill(t.dataset.id);
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-form]'); if (!f) return;
    e.preventDefault();
    ({ intro: submitIntro, sublot: submitLot, require: submitRequirement })[f.dataset.form](f);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openPanel) closePanel(); });
  document.addEventListener('input', function (e) { if (e.target.classList && e.target.classList.contains('bad')) e.target.classList.remove('bad'); });
  $('#xModel').addEventListener('change', function (e) { state.model = e.target.value; renderFloor(); });
  $('#xRegion').addEventListener('change', function (e) { state.region = e.target.value; renderFloor(); });

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  var first = true;
  async function refresh() {
    try { state.floor = await X.floor(); state.error = false; } catch (e) { state.error = true; console.error(e); }
    state.loaded = true;
    renderTape(); renderFloor(); renderDemand();
    if (!first) return;
    first = false;
    var m = location.hash.match(/^#lot=(.+)$/);
    if (m) openLot(decodeURIComponent(m[1]));
    else if (location.hash === '#require') openRequirement();
    else if (location.hash === '#sell-lot') openSubmitLot();
  }
  X.onChange(function () { if (!openPanel) refresh(); });
  renderChrome(); renderTape();
  refresh();
})();
