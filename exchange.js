// The Chief Negotiators Exchange — public + member UI
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
  function lotNo(l) { var m = String(l.ref || '').match(/(\d+)$/); return m ? m[1] : '—'; }
  function money(v, unit) {
    if (v == null) return '';
    var hourly = /hr|hour/i.test(unit || '');
    return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: hourly ? 2 : 0, maximumFractionDigits: 2 });
  }
  function kindName(k) { return k === 'gpuaas' ? 'GPUaaS' : k === 'hardware' ? 'Hardware' : 'Hardware or GPUaaS'; }
  var INTRO_ST = { new: 'Received. The desk will call you', call_booked: 'Call booked', ncnda: 'NCNDA in progress', terms: 'Negotiating terms', closed_won: 'Closed', closed_lost: 'Closed without a deal' };
  var LOT_ST = { review: 'In review', live: 'On the floor', reserved: 'Under offer', closed: 'Closed', declined: 'Not listed' };

  function who() {
    var s = X.session();
    if (!s) return 'guest';
    var m = s.member || {};
    if (m.is_admin) return 'member';
    return m.status === 'approved' ? 'member' : 'pending';
  }
  function me() { var s = X.session(); return (s && s.member) || {}; }

  function toast(msg) { var t = $('#xToast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 2800); }
  function bookBtn(label, cls) { return '<a class="x-btn ' + (cls || '') + '" href="' + esc(BOOK) + '" target="_blank" rel="noopener" data-act="booked">' + esc(label) + '</a>'; }
  var LOCK = '<svg class="x-seal-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>';

  // ------------------------------------------------------------------
  // Header, hero, footer
  // ------------------------------------------------------------------
  function renderChrome() {
    var w = who();
    var acct = $('#xAcct'), hero = $('#xHeroCta'), sell = $('#xSellCta');
    if (w === 'guest') {
      acct.innerHTML = '<button class="x-btn ghost sm" data-act="signin">Sign in</button><button class="x-btn sm" data-act="apply">Apply</button>';
      hero.innerHTML = '<button class="x-btn" data-act="apply">Apply for membership</button>' + bookBtn('Book an allocation call', 'ghost');
      sell.innerHTML = '<button class="x-btn" data-act="apply" data-side="seller">Apply as a seller</button>' + bookBtn('Talk to the desk first', 'ghost');
    } else if (w === 'pending') {
      acct.innerHTML = '<button class="x-btn ghost sm" data-act="signout">Sign out</button>' + bookBtn('Book your approval call', 'sm');
      hero.innerHTML = bookBtn('Book your approval call') + '<a class="x-btn ghost" href="#floor">Browse the floor</a>';
      sell.innerHTML = bookBtn('Book your approval call');
    } else {
      acct.innerHTML = '<button class="x-btn ghost sm" data-act="mine">My desk</button><button class="x-btn sm" data-act="signout">Sign out</button>';
      hero.innerHTML = '<a class="x-btn" href="#floor">Browse the floor</a><button class="x-btn ghost" data-act="require">Post a requirement</button>';
      sell.innerHTML = '<button class="x-btn" data-act="sublot">Submit a lot</button>' + bookBtn('Talk to the desk', 'ghost');
    }
    $('#xFootContact').innerHTML =
      (CONTACT.phone ? '<a href="tel:' + esc(CONTACT.phoneHref || CONTACT.phone) + '">' + esc(CONTACT.phone) + '</a>' : '') +
      (CONTACT.email ? '<a href="mailto:' + esc(CONTACT.email) + '">' + esc(CONTACT.email) + '</a>' : '') +
      '<a href="' + esc(BOOK) + '" target="_blank" rel="noopener">Book an allocation call</a>';
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
    if (who() !== 'member') {
      var fake = l.kind === 'gpuaas' ? '$0.00' : '$00,000';
      return '<span class="x-sealed"><span class="blur" aria-hidden="true">' + fake + '</span><span class="lk">' + LOCK + ' Terms for members</span></span><span class="s">Min ' + num(l.min_commit || 64) + '</span>';
    }
    if (l.price != null) {
      var sub = [l.deposit_pct ? l.deposit_pct + '% deposit' : '', l.term_months ? l.term_months + '-month term' : ''].filter(Boolean).join(', ');
      return '<span class="p">' + money(l.price, l.price_unit) + '<small>' + esc(l.price_unit || '') + '</small></span><span class="s">' + esc(sub) + '</span>';
    }
    return '<span class="p" style="font-size:19px">Price on the call</span><span class="s">Min ' + num(l.min_commit || 64) + ' GPUs</span>';
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
    var models = {}, regions = {};
    state.floor.forEach(function (l) { models[l.model] = 1; if (l.region) regions[l.region] = 1; });
    fillSelect($('#xModel'), 'Every model', Object.keys(models), state.model);
    fillSelect($('#xRegion'), 'Every region', Object.keys(regions), state.region);
    var shown = state.floor.filter(function (l) {
      return (state.kind === 'all' || l.kind === state.kind) && (!state.model || l.model === state.model) && (!state.region || l.region === state.region);
    });
    $('#xCount').textContent = shown.length + (shown.length === 1 ? ' lot' : ' lots') + ', ' + num(shown.reduce(function (a, l) { return a + (l.gpu_count || 0); }, 0)) + ' GPUs';
    mount.innerHTML = shown.length ? shown.map(lotCard).join('') :
      '<div class="x-gate" style="grid-column:1/-1"><h3>Nothing on the floor matches that yet.</h3><p>Most allocation is placed before it is ever listed. Tell us what you need and the desk will source it.</p>' +
      (who() === 'member' ? '<button class="x-btn" data-act="require">Post a requirement</button>' : bookBtn('Tell the desk what you need')) + '</div>';
  }
  function fillSelect(sel, first, vals, cur) {
    var html = '<option value="">' + first + '</option>' + vals.sort().map(function (v) { return '<option' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('');
    if (sel.innerHTML !== html) sel.innerHTML = html;
  }

  // ------------------------------------------------------------------
  // Demand board
  // ------------------------------------------------------------------
  async function renderDemand() {
    var mount = $('#xDemand'), cta = $('#xDemandCta'), w = who();
    if (w !== 'member') {
      cta.innerHTML = '';
      mount.innerHTML = '<div class="x-gate"><h3>The requirements board is for members.</h3><p>Sellers use it to see verified demand before anyone else does: model, volume, region and timing, with buyers kept anonymous.</p>' +
        (w === 'guest' ? '<button class="x-btn" data-act="apply" data-side="seller">Apply as a seller</button>' : bookBtn('Book your approval call')) + '</div>';
      return;
    }
    cta.innerHTML = '<button class="x-btn ghost" data-act="require">Post a requirement</button>';
    var rows = [];
    try { rows = await X.demand(); } catch (e) { mount.innerHTML = '<p class="x-empty">Could not load requirements: ' + esc(e.message) + '</p>'; return; }
    mount.innerHTML = rows.length ? '<div class="x-demand">' + rows.map(function (r) {
      return '<div class="x-dem-row"><span class="m">' + esc(r.model) + ' <span class="d" style="font:13px var(--sans)">' + esc(kindName(r.kind)) + '</span></span><span>' + num(r.gpu_count) + ' GPUs</span><span class="d">' + esc(r.region || 'Any region') + '</span><span class="d">' + esc(r.timeline || '') + '</span><button class="x-btn ghost sm" data-act="fill" data-id="' + esc(r.id) + '">Offer to fill</button></div>';
    }).join('') + '</div>' : '<p class="x-empty">No open requirements right now. Post yours and sellers will see it.</p>';
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
    if (/^#lot=/.test(location.hash)) history.replaceState(null, '', location.pathname);
  }
  function setPanel(html) { if (openPanel) openPanel.p.querySelector('.x-panel-in').innerHTML = html; }

  // ---- Lot detail ----
  function openLot(id) {
    var l = state.floor.filter(function (x) { return x.id === id || x.ref === id; })[0];
    if (!l) return;
    history.replaceState(null, '', '#lot=' + encodeURIComponent(l.ref));
    var w = who();
    var facts = [
      ['GPUs', num(l.gpu_count)], ['Configuration', l.config || 'On request'],
      ['Available', l.available || 'On request'], ['Region', l.region || 'On request'],
      [l.kind === 'gpuaas' ? 'Term' : 'Condition', l.kind === 'gpuaas' ? (l.term_months ? l.term_months + ' months' : 'Flexible') : (l.condition || 'On request')],
      ['Minimum order', num(l.min_commit || 64) + ' GPUs'],
    ];
    if (w === 'member') {
      facts.push(['Price', l.price != null ? money(l.price, l.price_unit) + ' ' + (l.price_unit || '') : 'Discussed on the call']);
      facts.push(['Deposit', l.deposit_pct ? l.deposit_pct + '%' : 'Negotiable']);
    }
    var head = '<div class="x-detail-band"><div class="x-kicker">Lot ' + esc(lotNo(l)) + ', ' + esc(kindName(l.kind)) + (l.status === 'reserved' ? ', under offer' : '') + '</div><h2>' + esc(l.model) + '</h2><div style="color:var(--smoke);font-size:13px">Reference ' + esc(l.ref) + '</div></div>' +
      '<dl class="x-detail-facts">' + facts.map(function (f) { return '<div><dt>' + f[0] + '</dt><dd>' + esc(f[1]) + '</dd></div>'; }).join('') + '</dl>' +
      (w === 'member' && l.notes ? '<p style="color:var(--smoke);margin:18px 0 0">' + esc(l.notes) + '</p>' : '');

    var act;
    if (w === 'guest') {
      act = '<div class="x-callout"><h4>Terms on this lot are sealed.</h4><p>Approved members see price, deposit and seller notes, and can request an introduction. Approval happens on a 20-minute call.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="x-btn" data-act="apply" data-lot="' + esc(l.ref) + '">Apply to see terms</button>' + bookBtn('Ask about lot ' + lotNo(l) + ' on a call', 'ghost') + '</div></div>';
    } else if (w === 'pending') {
      act = '<div class="x-callout"><h4>Your application is in review.</h4><p>Terms unlock the moment you are approved. The fastest route is a 20-minute call; mention lot ' + esc(lotNo(l)) + ' and we will walk through it with you.</p>' + bookBtn('Book your approval call') + '</div>';
    } else {
      var reserved = l.status === 'reserved';
      act = '<div class="x-callout quiet"><h4>' + (reserved ? 'Take the backup position' : 'Request an introduction') + '</h4><p>' + (reserved ? 'This lot is under offer. Backup positions are called in order if the current deal does not close.' : 'The desk confirms allocation with the seller, runs the NCNDA and sets up the call. Sellers do not see your name until you both agree to proceed.') + '</p>' +
        '<form class="x-form" data-form="intro" data-id="' + esc(l.id) + '" data-ref="' + esc(l.ref) + '">' +
        '<div class="x-field"><label for="iq">GPUs needed <i>*</i></label><input class="x-in" id="iq" name="gpu_count" type="number" min="1" max="' + esc(l.gpu_count) + '" value="' + esc(Math.min(l.gpu_count, Math.max(l.min_commit || 64, 64))) + '" required></div>' +
        '<div class="x-field"><label for="it">Timeline <i>*</i></label><select class="x-in" id="it" name="timeline" required><option>Ready to commit now</option><option>This quarter</option><option>Next quarter</option><option>Exploring</option></select></div>' +
        '<div class="x-field full"><label for="ip">Best number for the desk <i>*</i></label><input class="x-in" id="ip" name="phone" type="tel" autocomplete="tel" value="' + esc(me().phone || '') + '" required></div>' +
        '<div class="x-field full"><label for="im">Anything the desk should know</label><textarea class="x-in" id="im" name="message" placeholder="Term, ramp schedule, delivery site, financing"></textarea></div>' +
        '<div class="full x-actions" style="border:0;padding:0;margin:4px 0 0"><span class="x-err" data-err></span><button class="x-btn" type="submit">' + (reserved ? 'Take the backup position' : 'Request introduction') + '</button></div></form></div>';
    }
    panel(head + act);
  }

  async function submitIntro(form) {
    var fd = new FormData(form), err = form.querySelector('[data-err]');
    var body = { direction: form.dataset.dir || 'buy', gpu_count: +fd.get('gpu_count') || null, timeline: fd.get('timeline'), phone: String(fd.get('phone') || '').trim(), message: String(fd.get('message') || '').trim() };
    if (form.dataset.id && body.direction === 'buy') body.listing_id = form.dataset.id;
    if (body.direction === 'supply') body.requirement_id = form.dataset.id;
    if (!body.phone) { err.textContent = 'Add a number so the desk can reach you'; form.querySelector('[name=phone]').classList.add('bad'); return; }
    var btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Sending';
    try {
      await X.requestIntro(body);
      var m = me();
      X.notify('[INTRO · CALL NOW] ' + (m.company || m.email) + ' — ' + (body.direction === 'buy' ? 'lot ' + form.dataset.ref : 'offer to fill requirement'), {
        Member: m.full_name, Company: m.company, Email: m.email, Phone: body.phone, Direction: body.direction,
        Lot: form.dataset.ref || '', GPUs: body.gpu_count, Timeline: body.timeline, Message: body.message || '—', Tier: m.tier || '', Score: m.score || '',
      });
      setPanel('<div class="x-kicker">' + (body.direction === 'buy' ? 'Lot ' + esc(String(form.dataset.ref || '').replace(/.*-/, '')) : 'Requirement') + '</div><h2>Introduction requested.</h2><p class="sub">The desk is confirming allocation with the ' + (body.direction === 'buy' ? 'seller' : 'buyer') + ' now.</p>' +
        '<div class="x-callout"><h4>Lock in your call while this is fresh.</h4><p>Lots move to the members who are ready to talk. A 20-minute call is how we hold this one for you.</p>' + bookBtn('Book the call now', 'block') + '</div>' +
        '<p style="color:var(--smoke);font-size:14px">Prefer a call back? We will ring ' + esc(body.phone) + ' within one business hour.</p>');
      refresh();
    } catch (e) { err.textContent = e.message; btn.disabled = false; btn.textContent = 'Try again'; }
  }

  // ---- Apply funnel ----
  var SELLER_MODEL = {
    holder: { label: 'Your position', opts: [
      { v: 'owner', t: 'We own or operate it', s: 'Direct holder', p: 35 },
      { v: 'oem', t: 'OEM or NVIDIA allocation', s: 'Allocated to us', p: 30 },
      { v: 'mandate', t: 'Exclusive mandate from the owner', s: 'Written mandate', p: 18 },
      { v: 'broker', t: 'Broker, no mandate', s: 'Not the holder', p: 0, dq: true } ] },
    volume: { label: 'GPUs available', opts: [
      { v: '2048', t: '2,048+', s: 'Cluster scale', p: 25 }, { v: '512', t: '512–2,047', s: 'Multi-rack', p: 20 },
      { v: '128', t: '128–511', s: 'Rack scale', p: 14 }, { v: '64', t: '64–127', s: 'Minimum lot', p: 8 } ] },
    readiness: { label: 'Availability', opts: [
      { v: 'now', t: 'Within 30 days', s: 'Ready now', p: 20 }, { v: 'quarter', t: 'This quarter', s: '', p: 16 },
      { v: 'next', t: 'Next two quarters', s: '', p: 12 }, { v: 'later', t: 'Later than that', s: '', p: 6 } ] },
    proof: { label: 'Proof of allocation under NCNDA', opts: [
      { v: 'yes', t: 'Ready to share now', s: '', p: 20 }, { v: 'week', t: 'Within a week', s: '', p: 12 }, { v: 'no', t: 'Not yet', s: '', p: 2 } ] },
  };
  var BUYER_MODEL = (window.TCNLeads && window.TCNLeads.MODEL) || {};
  var TIERS = (window.TCNLeads && window.TCNLeads.TIERS) || { priority: { min: 72 }, qualified: { min: 45 } };
  var FREE = /@(gmail|yahoo|hotmail|outlook|aol|icloud|proton|protonmail|live|msn)\./i;

  function scoreWith(model, a) {
    var total = 0, max = 0, dq = false;
    Object.keys(model).forEach(function (k) {
      var top = Math.max.apply(null, model[k].opts.map(function (o) { return o.p; }));
      max += top;
      var o = model[k].opts.filter(function (x) { return x.v === a[k]; })[0];
      if (o) { total += o.p; if (o.dq) dq = true; }
    });
    var s = Math.round(100 * total / (max || 1));
    return { score: s, dq: dq, tier: dq ? 'waitlist' : s >= TIERS.priority.min ? 'priority' : s >= TIERS.qualified.min ? 'qualified' : 'waitlist' };
  }

  var app = {};
  function openApply(side, lotRef) {
    app = { side: side || '', step: side ? 1 : 0, lot: lotRef || '' };
    panel('', { center: true });
    renderApply();
  }
  function optGroup(name, model, val) {
    return '<div class="x-q" data-q="' + name + '"><span>' + esc(model.label) + '</span><div class="x-opts">' + model.opts.map(function (o) {
      return '<label class="x-opt"><input type="radio" name="' + name + '" value="' + o.v + '"' + (val === o.v ? ' checked' : '') + '><span>' + esc(o.t) + (o.s ? '<small>' + esc(o.s) + '</small>' : '') + '</span></label>';
    }).join('') + '</div></div>';
  }
  function renderApply() {
    var ind = '<div class="x-steps-ind">' + [0, 1, 2].map(function (i) { return '<i class="' + (i <= app.step ? 'on' : '') + '"></i>'; }).join('') + '</div>';
    var h;
    if (app.step === 0) {
      h = '<h2>Apply for membership</h2><p class="sub">Two minutes. Strong applications are offered a call the same day.</p>' + ind +
        '<form data-form="apply"><div class="x-side-pick">' +
        [['buyer', 'Buy', 'Hardware or GPUaaS'], ['seller', 'Sell', 'Allocation or capacity'], ['both', 'Both', 'Buy and sell']].map(function (s) {
          return '<label class="x-opt"><input type="radio" name="side" value="' + s[0] + '"' + (app.side === s[0] ? ' checked' : '') + '><span><b>' + s[1] + '</b>' + s[2] + '</span></label>';
        }).join('') + '</div><div class="x-actions"><span class="x-err" data-err></span><button class="x-btn" type="submit">Continue</button></div></form>';
    } else if (app.step === 1) {
      var f = function (n, l, t, req, ph, ac) { return '<div class="x-field' + (n === 'email' || n === 'website' ? '' : '') + '"><label for="a_' + n + '">' + l + (req ? ' <i>*</i>' : '') + '</label><input class="x-in" id="a_' + n + '" name="' + n + '" type="' + (t || 'text') + '" value="' + esc(app[n] || '') + '"' + (ph ? ' placeholder="' + ph + '"' : '') + (ac ? ' autocomplete="' + ac + '"' : '') + '></div>'; };
      h = '<h2>Who you are</h2><p class="sub">We verify every member. A company email and direct number speed that up.</p>' + ind +
        '<form data-form="apply"><div class="x-form">' + f('name', 'Full name', 'text', 1, '', 'name') + f('title', 'Title', 'text', 0, '', 'organization-title') +
        f('company', 'Company', 'text', 1, '', 'organization') + f('website', 'Company website', 'url', 0, 'https://', 'url') +
        f('email', 'Work email', 'email', 1, '', 'email') + f('phone', 'Direct number', 'tel', 1, '', 'tel') +
        '</div><div class="x-actions"><button class="x-link" type="button" data-act="aback">Back</button><span class="x-err" data-err></span><button class="x-btn" type="submit">Continue</button></div></form>';
    } else {
      var qs = '';
      if (app.side !== 'seller') Object.keys(BUYER_MODEL).forEach(function (k) { qs += optGroup(k, BUYER_MODEL[k], app[k]); });
      if (app.side !== 'buyer') Object.keys(SELLER_MODEL).forEach(function (k) { if (app.side === 'both' && k !== 'holder') return; qs += optGroup(k, SELLER_MODEL[k], app[k]); });
      h = '<h2>' + (app.side === 'seller' ? 'What you hold' : 'What you need') + '</h2><p class="sub">This decides how fast we can approve you. Answer as it stands today.</p>' + ind +
        '<form data-form="apply"><div class="x-form">' + qs +
        '<div class="x-field full"><label for="a_notes">' + (app.side === 'seller' ? 'Models, configuration, location' : 'Models and timing you are targeting') + '</label><textarea class="x-in" id="a_notes" name="notes" placeholder="' + (app.side === 'seller' ? '256 B300, HGX, US East, Q1 2027' : '512 B300 or GB300, live by Q1 2027, 3-year term') + '">' + esc(app.notes || app.lot ? (app.notes || 'Interested in lot ' + app.lot) : '') + '</textarea></div></div>' +
        '<div class="x-actions"><button class="x-link" type="button" data-act="aback">Back</button><span class="x-err" data-err></span><button class="x-btn" type="submit">Submit application</button></div></form>';
    }
    setPanel(h);
  }

  async function stepApply(form) {
    var fd = new FormData(form), err = form.querySelector('[data-err]');
    form.querySelectorAll('.bad').forEach(function (x) { x.classList.remove('bad'); });
    if (app.step === 0) {
      if (!fd.get('side')) { err.textContent = 'Choose one to continue'; return; }
      app.side = fd.get('side'); app.step = 1; renderApply(); return;
    }
    if (app.step === 1) {
      var miss = [];
      ['name', 'company', 'email', 'phone', 'title', 'website'].forEach(function (k) { app[k] = String(fd.get(k) || '').trim(); });
      ['name', 'company', 'email', 'phone'].forEach(function (k) { if (!app[k]) miss.push(k); });
      if (app.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(app.email)) miss.push('email');
      if (miss.length) { miss.forEach(function (k) { form.querySelector('[name=' + k + ']').classList.add('bad'); }); err.textContent = miss.length === 1 ? 'One field still needed' : miss.length + ' fields still needed'; form.querySelector('.bad').focus(); return; }
      app.step = 2; renderApply(); return;
    }
    var need = [];
    form.querySelectorAll('[data-q]').forEach(function (q) { var k = q.dataset.q; app[k] = fd.get(k) || ''; if (!app[k]) { need.push(k); q.classList.add('bad'); } });
    app.notes = String(fd.get('notes') || '').trim();
    if (need.length) { err.textContent = need.length === 1 ? 'One answer still needed' : need.length + ' answers still needed'; return; }

    // Score. "Both" members are scored as buyers, with the seller holder check for brokers.
    var r = app.side === 'seller' ? scoreWith(SELLER_MODEL, app) : scoreWith(BUYER_MODEL, app);
    if (app.side === 'both' && app.holder === 'broker') { r.dq = true; r.tier = 'waitlist'; }
    var freeMail = FREE.test(app.email);
    var payload = { side: app.side, name: app.name, title: app.title, company: app.company, website: app.website, email: app.email, phone: app.phone, notes: app.notes, lot: app.lot, score: r.score, tier: r.tier, dq: r.dq, freeMail: freeMail };
    Object.keys(BUYER_MODEL).concat(Object.keys(SELLER_MODEL)).forEach(function (k) { if (app[k]) payload[k] = app[k]; });

    var btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Submitting';
    try {
      var res = await X.apply(payload);
      X.notify('[' + r.tier.toUpperCase() + ' ' + r.score + '/100' + (r.tier !== 'waitlist' ? ' · CALL NOW' : '') + '] ' + app.company + ' — exchange ' + app.side + ' application', {
        Tier: r.tier, Score: r.score, Side: app.side, Name: app.name, Title: app.title, Company: app.company, Email: app.email, Phone: app.phone,
        Website: app.website, Lot: app.lot || '—', Notes: app.notes || '—', Flags: [r.dq ? 'BROKER, NO MANDATE' : '', freeMail ? 'FREE EMAIL' : ''].filter(Boolean).join(', ') || 'none',
      });
      // Also land it in the admin console's Leads tab on this device.
      try { var k = (window.TCNLeads && window.TCNLeads.KEY) || 'tcn_leads_v1'; var L = JSON.parse(localStorage.getItem(k) || '[]'); L.unshift(Object.assign({ id: 'ld_' + Date.now().toString(36), created: Date.now(), source: 'exchange.html' }, payload)); localStorage.setItem(k, JSON.stringify(L)); } catch (e2) {}
      renderResult(r, freeMail, res);
      refresh();
    } catch (e) { err.textContent = e.message; btn.disabled = false; btn.textContent = 'Submit application'; }
  }

  function renderResult(r, freeMail, res) {
    var mail = res && !res.demo ? '<p style="color:var(--smoke);font-size:14px;margin-top:18px">We also sent a sign-in link to ' + esc(app.email) + '. Use it to return to your desk once you are approved.</p>' : '';
    var h;
    if (r.dq) {
      h = '<div class="x-kicker">Application received</div><h2>We work with holders and end users.</h2><p class="sub">The exchange is closed to brokers without a written mandate, so the desk can vouch for every counterparty. If you hold a mandate from the owner, reply to our confirmation email with it and we will review again.</p>';
    } else if (r.tier === 'priority' || r.tier === 'qualified') {
      h = '<div class="x-kicker">' + (r.tier === 'priority' ? 'Pre-qualified, priority' : 'Pre-qualified') + '</div><h2>You are at the front of the queue.</h2>' +
        '<div class="x-result-score"><b>' + r.score + '</b><span>out of 100</span></div><div class="x-meter"><i data-meter style="width:0"></i></div>' +
        '<div class="x-callout"><h4>Approval happens on a 20-minute call.</h4><p>' + (r.tier === 'priority' ? 'Priority applicants are usually approved the same day. ' : '') + 'Pick a time now and we will come prepared with lots that fit' + (app.lot ? ', starting with lot ' + esc(String(app.lot).replace(/.*-/, '')) : '') + '.</p>' + bookBtn('Book your approval call', 'block') + '</div>' +
        '<p style="color:var(--smoke);font-size:14px">Or we will call ' + esc(app.phone) + ' within one business hour.</p>';
    } else {
      h = '<div class="x-kicker">Application received</div><h2>We will review this within two business days.</h2><p class="sub">If your timeline is tighter than that, book a call and we will review it with you live.</p>' + bookBtn('Book a call', 'ghost');
    }
    if (freeMail && !r.dq) h += '<p style="color:var(--smoke);font-size:13px;margin-top:14px">Tip: a company email verifies faster than a personal one.</p>';
    setPanel(h + mail);
    setTimeout(function () { var m = document.querySelector('[data-meter]'); if (m) m.style.width = r.score + '%'; }, 80);
  }

  // ---- Sign in ----
  function openSignIn() {
    panel('<h2>Sign in</h2><p class="sub">We will email you a one-time sign-in link. No password to remember.</p><form data-form="signin"><div class="x-field"><label for="si">Work email</label><input class="x-in" id="si" name="email" type="email" autocomplete="email" required></div><div class="x-actions"><button class="x-link" type="button" data-act="apply">Not a member? Apply</button><span class="x-err" data-err></span><button class="x-btn" type="submit">Email me a link</button></div></form>', { center: true });
  }
  async function submitSignIn(form) {
    var email = String(new FormData(form).get('email') || '').trim(), err = form.querySelector('[data-err]');
    try { var r = await X.signIn(email); if (r.demo) { closePanel(); toast('Signed in'); } else setPanel('<h2>Check your inbox.</h2><p class="sub">A sign-in link is on its way to ' + esc(email) + '. It expires in one hour.</p>'); }
    catch (e) { err.textContent = e.message; }
  }

  // ---- Seller: submit a lot ----
  function openSubmitLot() {
    var sel = function (n, l, opts, req) { return '<div class="x-field"><label for="s_' + n + '">' + l + (req ? ' <i>*</i>' : '') + '</label><select class="x-in" id="s_' + n + '" name="' + n + '">' + opts.map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select></div>'; };
    var inp = function (n, l, t, ph, req) { return '<div class="x-field"><label for="s_' + n + '">' + l + (req ? ' <i>*</i>' : '') + '</label><input class="x-in" id="s_' + n + '" name="' + n + '" type="' + (t || 'text') + '"' + (ph ? ' placeholder="' + ph + '"' : '') + (t === 'number' ? ' step="any" min="0"' : '') + '></div>'; };
    panel('<h2>Submit a lot</h2><p class="sub">The desk reviews every lot before it reaches the floor, usually the same business day. Your company name is never shown to buyers.</p>' +
      '<form data-form="sublot"><div class="x-form">' +
      sel('kind', 'Type', ['GPUaaS', 'Hardware'], 1) + sel('model', 'Model', ['Vera Rubin', 'GB300', 'B300', 'GB200', 'B200', 'H200', 'H100', 'Other'], 1) +
      inp('config', 'Configuration', 'text', 'HGX 8-GPU, NVL72') + inp('gpu_count', 'GPUs', 'number', '', 1) +
      inp('available', 'Available', 'text', 'Immediate, Q1 2027', 1) + sel('region', 'Region', ['United States', 'Canada', 'EU', 'UK', 'Other'], 1) +
      inp('price', 'Price, members only', 'number', 'Leave blank to discuss on calls') + sel('price_unit', 'Price unit', ['per GPU-hr', 'per GPU', 'per node']) +
      inp('term_months', 'Term (months)', 'number', 'GPUaaS only') + inp('deposit_pct', 'Deposit %', 'number', '') +
      inp('min_commit', 'Minimum order (GPUs)', 'number', '64') + sel('condition', 'Condition', ['Not applicable', 'New, sealed', 'New, open box', 'Refurbished', 'Pre-owned']) +
      '<div class="x-field full"><label for="s_notes">Notes for approved members</label><textarea class="x-in" id="s_notes" name="notes" placeholder="Cooling, fabric, site tier, documentation available"></textarea></div>' +
      '</div><div class="x-actions"><span class="x-err" data-err></span><button class="x-btn" type="submit">Submit for review</button></div></form>', { center: true });
  }
  async function submitLot(form) {
    var fd = new FormData(form), err = form.querySelector('[data-err]');
    var n = function (k) { var v = fd.get(k); return v === '' || v == null ? null : Number(v); };
    var l = {
      kind: fd.get('kind') === 'GPUaaS' ? 'gpuaas' : 'hardware', model: fd.get('model'), config: fd.get('config') || null, gpu_count: n('gpu_count'),
      available: fd.get('available') || null, region: fd.get('region'), price: n('price'), price_unit: fd.get('price_unit'),
      term_months: n('term_months'), deposit_pct: n('deposit_pct'), min_commit: n('min_commit') || 64,
      condition: fd.get('condition') === 'Not applicable' ? null : fd.get('condition'), notes: fd.get('notes') || null,
    };
    if (!l.gpu_count || !l.available) { err.textContent = 'GPUs and availability are required'; return; }
    try {
      var r = await X.submitListing(l);
      var m = me();
      X.notify('[NEW LOT · REVIEW] ' + (m.company || '') + ' — ' + l.gpu_count + ' ' + l.model, { Seller: m.company, Contact: m.full_name, Email: m.email, Phone: m.phone, Lot: JSON.stringify(l) });
      setPanel('<div class="x-kicker">' + esc(r.ref || 'Submitted') + '</div><h2>Lot submitted for review.</h2><p class="sub">The desk will verify allocation before it goes live. Book a short call to go live faster: we confirm documents and pricing strategy in one pass.</p>' + bookBtn('Book a listing call'));
      refresh();
    } catch (e) { err.textContent = e.message; }
  }

  // ---- Buyer: post a requirement ----
  function openRequirement() {
    panel('<h2>Post a requirement</h2><p class="sub">Sellers on the exchange see the model, volume, region and timing. They never see your name.</p>' +
      '<form data-form="require"><div class="x-form">' +
      '<div class="x-field"><label for="r_kind">Type</label><select class="x-in" id="r_kind" name="kind"><option value="either">Hardware or GPUaaS</option><option value="hardware">Hardware</option><option value="gpuaas">GPUaaS</option></select></div>' +
      '<div class="x-field"><label for="r_model">Model <i>*</i></label><select class="x-in" id="r_model" name="model"><option>B300</option><option>GB300</option><option>Vera Rubin</option><option>B200</option><option>H200</option><option>H100</option><option>Open to options</option></select></div>' +
      '<div class="x-field"><label for="r_gpus">GPUs <i>*</i></label><input class="x-in" id="r_gpus" name="gpu_count" type="number" min="1" required></div>' +
      '<div class="x-field"><label for="r_region">Region</label><select class="x-in" id="r_region" name="region"><option>United States</option><option>Canada</option><option>EU</option><option>UK</option><option>Any</option></select></div>' +
      '<div class="x-field"><label for="r_tl">Timeline</label><input class="x-in" id="r_tl" name="timeline" placeholder="Live by Q1 2027"></div>' +
      '<div class="x-field"><label for="r_budget">Budget</label><input class="x-in" id="r_budget" name="budget" placeholder="Visible to the desk only"></div>' +
      '<div class="x-field full"><label for="r_notes">Notes for the desk</label><textarea class="x-in" id="r_notes" name="notes"></textarea></div>' +
      '</div><div class="x-actions"><span class="x-err" data-err></span><button class="x-btn" type="submit">Post requirement</button></div></form>', { center: true });
  }
  async function submitRequirement(form) {
    var fd = new FormData(form), err = form.querySelector('[data-err]');
    var r = { kind: fd.get('kind'), model: fd.get('model'), gpu_count: +fd.get('gpu_count') || null, region: fd.get('region'), timeline: fd.get('timeline') || null, budget: fd.get('budget') || null, notes: fd.get('notes') || null };
    if (!r.gpu_count) { err.textContent = 'Add a GPU count'; return; }
    try {
      await X.postRequirement(r);
      var m = me();
      X.notify('[REQUIREMENT · CALL NOW] ' + (m.company || '') + ' — ' + r.gpu_count + ' ' + r.model, { Buyer: m.company, Contact: m.full_name, Email: m.email, Phone: m.phone, Requirement: JSON.stringify(r) });
      setPanel('<h2>Requirement posted.</h2><p class="sub">Sellers can see it now. The desk is also checking allocation that has not been listed yet, which is where most fills come from.</p><div class="x-callout"><h4>Fastest path to a fill</h4><p>Ten minutes on the phone lets us shop this off-market today.</p>' + bookBtn('Book a sourcing call') + '</div>');
      refresh();
    } catch (e) { err.textContent = e.message; }
  }

  // ---- Seller: offer to fill a requirement ----
  function openFill(id) {
    var r = (state.demand || []).filter(function (x) { return x.id === id; })[0]; if (!r) return;
    panel('<div class="x-kicker">Open requirement</div><h2>' + esc(num(r.gpu_count) + ' ' + r.model) + '</h2><p class="sub">' + esc([kindName(r.kind), r.region, r.timeline].filter(Boolean).join(', ')) + '</p>' +
      '<form class="x-form" data-form="intro" data-dir="supply" data-id="' + esc(r.id) + '">' +
      '<div class="x-field"><label for="fq">GPUs you can supply <i>*</i></label><input class="x-in" id="fq" name="gpu_count" type="number" min="1" value="' + esc(r.gpu_count) + '" required></div>' +
      '<div class="x-field"><label for="ft">Availability <i>*</i></label><select class="x-in" id="ft" name="timeline"><option>Within 30 days</option><option>This quarter</option><option>Next quarter</option><option>Later</option></select></div>' +
      '<div class="x-field full"><label for="fp">Best number for the desk <i>*</i></label><input class="x-in" id="fp" name="phone" type="tel" value="' + esc(me().phone || '') + '" required></div>' +
      '<div class="x-field full"><label for="fm">Configuration, pricing guidance, documents</label><textarea class="x-in" id="fm" name="message"></textarea></div>' +
      '<div class="full x-actions" style="border:0;padding:0;margin:4px 0 0"><span class="x-err" data-err></span><button class="x-btn" type="submit">Offer to fill</button></div></form>');
  }

  // ---- My desk ----
  async function openMine() {
    var p = panel('<h2>My desk</h2><p class="sub">Loading</p>');
    var d;
    try { d = await X.mine(); } catch (e) { setPanel('<h2>My desk</h2><p class="x-err">' + esc(e.message) + '</p>'); return; }
    var m = me();
    var list = function (rows, fn, empty) { return rows.length ? rows.map(fn).join('') : '<div class="x-empty">' + empty + '</div>'; };
    setPanel('<div class="x-kicker">' + esc(m.company || '') + '</div><h2>My desk</h2><p class="sub">' + esc(m.full_name || m.email || '') + '</p>' +
      '<div class="x-callout"><h4>Your desk line</h4><p>Anything moving faster than this page shows, call the desk directly.</p><div style="display:flex;gap:10px;flex-wrap:wrap">' + bookBtn('Book a call') + (CONTACT.phone ? '<a class="x-btn ghost" href="tel:' + esc(CONTACT.phoneHref || CONTACT.phone) + '">' + esc(CONTACT.phone) + '</a>' : '') + '</div></div>' +
      '<div class="x-mine"><h3>Introductions</h3>' + list(d.intros, function (i) { return '<div class="x-mine-row"><span>' + (i.direction === 'buy' ? esc((i.listing_model || '') + ' ' + (i.listing_ref || '')) : 'Offer to fill ' + esc(num(i.requirement_gpus) + ' ' + (i.requirement_model || ''))) + ', ' + num(i.gpu_count) + ' GPUs</span><span class="st">' + esc(INTRO_ST[i.status] || i.status) + '</span></div>'; }, 'None yet. Open any lot on the floor to request one.') +
      '<h3>Your lots</h3>' + list(d.listings, function (l) { return '<div class="x-mine-row"><span>' + esc(l.ref || '') + ', ' + num(l.gpu_count) + ' ' + esc(l.model) + '</span><span class="st">' + esc(LOT_ST[l.status] || l.status) + '</span></div>'; }, 'No lots submitted.') +
      '<h3>Your requirements</h3>' + list(d.requirements, function (r) { return '<div class="x-mine-row"><span>' + num(r.gpu_count) + ' ' + esc(r.model) + (r.region ? ', ' + esc(r.region) : '') + '</span><span class="st">' + esc(r.status === 'open' ? 'Open' : r.status === 'matched' ? 'Matched' : 'Closed') + '</span></div>'; }, 'No requirements posted.') +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:24px"><button class="x-btn ghost sm" data-act="sublot">Submit a lot</button><button class="x-btn ghost sm" data-act="require">Post a requirement</button></div></div>');
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
    if (a === 'booked') { X.notify('[CALL LINK CLICKED] ' + (me().company || me().email || 'guest'), { Who: me().email || 'guest', Page: location.href }); return; }
    e.preventDefault();
    if (a === 'close') closePanel();
    else if (a === 'lot') openLot(t.dataset.id);
    else if (a === 'apply') openApply(t.dataset.side, t.dataset.lot);
    else if (a === 'aback') { app.step = Math.max(0, app.step - 1); renderApply(); }
    else if (a === 'signin') openSignIn();
    else if (a === 'signout') X.signOut().then(function () { toast('Signed out'); });
    else if (a === 'mine') openMine();
    else if (a === 'sublot') openSubmitLot();
    else if (a === 'require') openRequirement();
    else if (a === 'fill') openFill(t.dataset.id);
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-form]'); if (!f) return;
    e.preventDefault();
    ({ apply: stepApply, intro: submitIntro, signin: submitSignIn, sublot: submitLot, require: submitRequirement })[f.dataset.form](f);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openPanel) closePanel(); });
  $('#xModel').addEventListener('change', function (e) { state.model = e.target.value; renderFloor(); });
  $('#xRegion').addEventListener('change', function (e) { state.region = e.target.value; renderFloor(); });

  // ------------------------------------------------------------------
  // Preview bar (demo mode only)
  // ------------------------------------------------------------------
  function previewBar() {
    if (X.mode !== 'demo') return;
    var b = document.createElement('div'); b.className = 'x-preview';
    b.innerHTML = '<span>Preview mode, sample data in this browser. View as</span><select aria-label="Preview as"><option value="guest">Guest</option><option value="pending">Applicant in review</option><option value="member">Approved buyer</option><option value="seller">Approved seller</option></select><button type="button">Reset sample data</button>';
    document.body.appendChild(b);
    var s = b.querySelector('select'); s.value = X.persona() === 'admin' ? 'member' : X.persona();
    s.addEventListener('change', function () { X.setPersona(s.value); });
    b.querySelector('button').addEventListener('click', function () { X.reset(); s.value = 'guest'; toast('Sample data reset'); });
    X.onChange(function () { var p = X.persona(); if (s.value !== p && p !== 'admin') s.value = p; });
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  async function refresh() {
    renderChrome();
    try { state.floor = await X.floor(); } catch (e) { state.floor = []; console.error(e); }
    state.loaded = true;
    renderTape(); renderFloor(); renderDemand();
    var m = location.hash.match(/^#lot=(.+)$/);
    if (m && !openPanel) openLot(decodeURIComponent(m[1]));
    if (location.hash === '#apply' && !openPanel) openApply();
    if (location.hash === '#apply-seller' && !openPanel) openApply('seller');
  }
  X.onChange(refresh);
  X.ready().then(refresh, refresh);
  previewBar();
  renderChrome(); renderTape();
})();
