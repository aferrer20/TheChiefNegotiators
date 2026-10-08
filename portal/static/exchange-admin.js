// Admin console: Exchange tab
// The desk's control room. First screen is always the "Call now" queue:
// every new introduction and every pre-qualified applicant, oldest first,
// with a speed-to-lead clock. Leads called inside an hour convert far better.
(function () {
  'use strict';
  var X = window.TCNX;
  if (!X) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var num = function (n) { return n == null ? '' : Number(n).toLocaleString('en-US'); };
  var tel = function (p) { return p ? '<a href="tel:' + esc(String(p).replace(/[^\d+]/g, '')) + '">' + esc(p) + '</a>' : '<span class="xa-mute">no number</span>'; };
  var mins = function (iso) { return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); };
  var age = function (iso) { var m = mins(iso); return m < 60 ? m + 'm' : m < 1440 ? Math.round(m / 60) + 'h' : Math.round(m / 1440) + 'd'; };
  var toast = function (m) { if (window.TCN && window.TCN.toast) window.TCN.toast(m); };
  var view = 'call';
  var data = { members: [], listings: [], intros: [], requirements: [] };
  var INTRO = [['new', 'New'], ['call_booked', 'Call booked'], ['ncnda', 'NCNDA'], ['terms', 'Terms'], ['closed_won', 'Won'], ['closed_lost', 'Lost']];
  var LOT = { review: 'In review', live: 'Live', reserved: 'Under offer', closed: 'Closed', declined: 'Declined' };

  function isAdmin() { if (X.mode === 'demo') return true; var s = X.session(); return !!(s && s.member && s.member.is_admin); }

  async function fetchAll() {
    var a = await Promise.all([X.admin.members(), X.admin.listings(), X.admin.intros(), X.admin.requirements()]);
    data = { members: a[0] || [], listings: a[1] || [], intros: a[2] || [], requirements: a[3] || [] };
  }

  function signInView(mount) {
    mount.innerHTML = '<div class="xa-gate"><h3>Sign in as the desk</h3><p>The Exchange tab reads live member, lot and deal data, so it needs an admin session. Use the email you marked as admin in Supabase.</p>' +
      '<div class="xa-row"><input class="xa-in" id="xaEmail" type="email" placeholder="sales@thechiefnegotiators.com"><button class="btn btn-primary btn-sm" id="xaSend">Email me a link</button></div><p class="xa-mute" id="xaMsg"></p></div>';
    mount.querySelector('#xaSend').onclick = async function () {
      var e = mount.querySelector('#xaEmail').value.trim(); if (!e) return;
      try { await X.signIn(e); mount.querySelector('#xaMsg').textContent = 'Check your inbox for the sign-in link.'; } catch (err) { mount.querySelector('#xaMsg').textContent = err.message; }
    };
  }

  function kpis() {
    var pend = data.members.filter(function (m) { return m.status === 'pending'; });
    var hotApps = pend.filter(function (m) { return m.tier === 'priority' || m.tier === 'qualified'; });
    var newIntros = data.intros.filter(function (i) { return i.status === 'new'; });
    var booked = data.intros.filter(function (i) { return i.status === 'call_booked'; }).length;
    var live = data.listings.filter(function (l) { return l.status === 'live'; });
    var rev = data.listings.filter(function (l) { return l.status === 'review'; }).length;
    var won = data.intros.filter(function (i) { return i.status === 'closed_won'; }).length;
    var callNow = newIntros.length + hotApps.length;
    return '<div class="xa-kpis">' + [
      ['Call now', callNow, 'intros + pre-qualified applicants', 'hot'],
      ['Applications', pend.length, hotApps.length + ' pre-qualified'],
      ['Lots in review', rev, ''],
      ['Live lots', live.length, num(live.reduce(function (a, l) { return a + l.gpu_count; }, 0)) + ' GPUs'],
      ['Calls booked', booked, 'from introductions'],
      ['Deals won', won, ''],
    ].map(function (k) { return '<div class="xa-kpi ' + (k[3] || '') + '"><div class="v">' + k[1] + '</div><div class="l">' + k[0] + '</div><div class="s">' + k[2] + '</div></div>'; }).join('') + '</div>';
  }

  function segs() {
    var c = function (n) { return '<span class="count">' + n + '</span>'; };
    var pend = data.members.filter(function (m) { return m.status === 'pending'; }).length;
    return '<div class="xa-seg">' + [
      ['call', 'Call now'], ['apps', 'Applications ' + c(pend)], ['lots', 'Lots ' + c(data.listings.length)], ['deals', 'Deals ' + c(data.intros.length)], ['match', 'Matches'],
    ].map(function (s) { return '<button data-xa-view="' + s[0] + '" class="' + (view === s[0] ? 'on' : '') + '">' + s[1] + '</button>'; }).join('') + '<span class="xa-mode">' + (X.mode === 'demo' ? 'Preview data. Connect Supabase in config.js to go live.' : 'Live, Supabase') + '</span></div>';
  }

  function tierPill(t, s) { return t ? '<span class="xa-pill ' + esc(t) + '">' + esc(t) + (s != null ? ' ' + s : '') + '</span>' : ''; }

  function callView() {
    var rows = [];
    data.intros.filter(function (i) { return i.status === 'new'; }).forEach(function (i) {
      var m = i.member || {}, l = i.listing, q = i.requirement;
      rows.push({ at: i.created_at, html:
        '<div class="xa-call"><div class="xa-clock' + (mins(i.created_at) > 60 ? ' late' : '') + '">' + age(i.created_at) + '</div>' +
        '<div class="xa-main"><b>' + esc(m.full_name || m.email) + '</b>, ' + esc(m.company || '') + ' ' + tierPill(m.tier, m.score) +
        '<div class="xa-sub">' + (i.direction === 'buy' ? 'Wants ' + num(i.gpu_count) + ' GPUs from ' + esc(l ? l.ref + ' (' + l.model + ')' : 'a lot') : 'Offers ' + num(i.gpu_count) + ' GPUs for ' + esc(q ? q.gpu_count + ' ' + q.model : 'a requirement')) + ', ' + esc(i.timeline || '') + (i.message ? '. "' + esc(i.message) + '"' : '') + '</div></div>' +
        '<div class="xa-phone">' + tel(i.phone || m.phone) + '</div>' +
        '<div class="xa-act"><button class="btn btn-primary btn-sm" data-xa-intro="' + i.id + '" data-to="call_booked">Call booked</button></div></div>' });
    });
    data.members.filter(function (m) { return m.status === 'pending' && m.tier !== 'waitlist'; }).forEach(function (m) {
      var a = m.answers || {};
      rows.push({ at: m.created_at, html:
        '<div class="xa-call"><div class="xa-clock' + (mins(m.created_at) > 60 ? ' late' : '') + '">' + age(m.created_at) + '</div>' +
        '<div class="xa-main"><b>' + esc(m.full_name) + '</b>, ' + esc(m.title ? m.title + ', ' : '') + esc(m.company) + ' ' + tierPill(m.tier, m.score) +
        '<div class="xa-sub">New ' + esc(m.side) + ' application' + (a.lot ? ', asked about ' + esc(a.lot) : '') + (a.notes ? '. "' + esc(a.notes) + '"' : '') + '</div></div>' +
        '<div class="xa-phone">' + tel(m.phone) + '</div>' +
        '<div class="xa-act"><button class="btn btn-primary btn-sm" data-xa-member="' + m.id + '" data-to="approved">Approve</button></div></div>' });
    });
    rows.sort(function (a, b) { return a.at > b.at ? 1 : -1; });
    return '<div class="xa-panel"><div class="xa-h"><h3>Call now</h3><span class="xa-mute">Oldest first. Red clocks are past one hour.</span></div>' +
      (rows.length ? rows.map(function (r) { return r.html; }).join('') : '<p class="xa-empty">Queue clear. Every intro and pre-qualified applicant has been handled.</p>') + '</div>';
  }

  function appsView() {
    var list = data.members.slice().sort(function (a, b) { return (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || (b.score || 0) - (a.score || 0); });
    return '<div class="xa-panel"><div class="xa-h"><h3>Applications and members</h3><span class="xa-mute">Approve on the call, not before it.</span></div><div class="xa-scroll"><table class="xa-t"><thead><tr><th>Applicant</th><th>Side</th><th>Score</th><th>Contact</th><th>Applied</th><th>Status</th><th></th></tr></thead><tbody>' +
      list.map(function (m) {
        var a = m.answers || {};
        var flags = [a.dq || m.tier === 'waitlist' && /broker/.test(JSON.stringify(a)) ? 'broker' : '', a.freeMail ? 'free email' : ''].filter(Boolean);
        return '<tr><td><b>' + esc(m.full_name || '') + '</b><div class="xa-sub">' + esc([m.title, m.company].filter(Boolean).join(', ')) + (m.website ? ' <a href="' + esc(m.website) + '" target="_blank" rel="noopener">site</a>' : '') + '</div>' + (flags.length ? '<div>' + flags.map(function (f) { return '<span class="xa-pill bad">' + f + '</span>'; }).join('') + '</div>' : '') + '</td>' +
          '<td>' + esc(m.side) + '</td><td>' + tierPill(m.tier, m.score) + '</td><td>' + tel(m.phone) + '<div class="xa-sub">' + esc(m.email) + '</div></td><td>' + age(m.created_at) + '</td><td>' + esc(m.is_admin ? 'admin' : m.status) + '</td>' +
          '<td class="xa-btns">' + (m.status !== 'approved' ? '<button class="btn btn-primary btn-sm" data-xa-member="' + m.id + '" data-to="approved">Approve</button>' : '') + (m.status !== 'declined' && !m.is_admin ? '<button class="btn btn-ghost btn-sm" data-xa-member="' + m.id + '" data-to="declined">Decline</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  function lotsView() {
    var order = { review: 0, live: 1, reserved: 2, closed: 3, declined: 4 };
    var list = data.listings.slice().sort(function (a, b) { return order[a.status] - order[b.status]; });
    return '<div class="xa-panel"><div class="xa-h"><h3>Lots</h3><span class="xa-mute">Verify allocation documents before going live. Seller identity is visible only here.</span></div><div class="xa-scroll"><table class="xa-t"><thead><tr><th>Lot</th><th>Size</th><th>Terms</th><th>Seller</th><th>Status</th><th></th></tr></thead><tbody>' +
      list.map(function (l) {
        var s = l.seller || {};
        var terms = l.price != null ? '$' + Number(l.price).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + esc(l.price_unit || '') : 'Price on call';
        var btn = function (lbl, patch, primary) { return '<button class="btn ' + (primary ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-xa-lot="' + l.id + '" data-patch=\'' + JSON.stringify(patch) + '\'>' + lbl + '</button>'; };
        var acts = l.status === 'review' ? btn('Go live', { status: 'live' }, 1) + btn('Decline', { status: 'declined' })
          : l.status === 'live' ? btn(l.featured ? 'Unfeature' : 'Desk pick', { featured: !l.featured }) + btn('Under offer', { status: 'reserved' }) + btn('Close', { status: 'closed' })
          : l.status === 'reserved' ? btn('Back to live', { status: 'live' }) + btn('Close', { status: 'closed' }) : btn('Relist', { status: 'review' });
        return '<tr><td><b>' + esc(l.model) + '</b> ' + (l.featured ? '<span class="xa-pill priority">desk pick</span>' : '') + '<div class="xa-sub">' + esc(l.ref || '') + ', ' + (l.kind === 'gpuaas' ? 'GPUaaS' : 'Hardware') + ', ' + esc(l.config || '') + '</div></td>' +
          '<td>' + num(l.gpu_count) + ' GPUs<div class="xa-sub">' + esc([l.region, l.available].filter(Boolean).join(', ')) + '</div></td>' +
          '<td>' + terms + '<div class="xa-sub">' + esc([l.deposit_pct ? l.deposit_pct + '% dep' : '', l.term_months ? l.term_months + ' mo' : '', 'min ' + (l.min_commit || 64)].filter(Boolean).join(', ')) + '</div></td>' +
          '<td>' + esc(s.company || '—') + '<div class="xa-sub">' + esc(s.full_name || '') + ' ' + tel(s.phone) + '</div></td>' +
          '<td>' + esc(LOT[l.status] || l.status) + '</td><td class="xa-btns">' + acts + '<a class="btn btn-ghost btn-sm" href="exchange.html#lot=' + encodeURIComponent(l.ref || '') + '" target="_blank" rel="noopener">View</a></td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  function dealsView() {
    return '<div class="xa-panel"><div class="xa-h"><h3>Deals</h3><span class="xa-mute">Every introduction, from first call to close.</span></div><div class="xa-board">' +
      INTRO.map(function (col) {
        var items = data.intros.filter(function (i) { return i.status === col[0]; });
        return '<div class="xa-col"><div class="xa-col-h">' + col[1] + ' <span>' + items.length + '</span></div>' + items.map(function (i) {
          var m = i.member || {}, l = i.listing, q = i.requirement, s = (l && l.seller) || {};
          return '<div class="xa-card"><b>' + esc(m.company || m.email) + '</b>' + tierPill(m.tier) +
            '<div class="xa-sub">' + (i.direction === 'buy' ? num(i.gpu_count) + ' GPUs, ' + esc(l ? l.ref : '') : 'Fill ' + esc(q ? q.gpu_count + ' ' + q.model : '')) + '</div>' +
            (i.direction === 'buy' && s.company ? '<div class="xa-sub">Seller: ' + esc(s.company) + '</div>' : '') +
            '<div class="xa-sub">' + tel(i.phone || m.phone) + ', ' + age(i.created_at) + '</div>' +
            '<select class="xa-sel" data-xa-istatus="' + i.id + '">' + INTRO.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === i.status ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>';
        }).join('') + '</div>';
      }).join('') + '</div></div>';
  }

  function matchView() {
    var live = data.listings.filter(function (l) { return l.status === 'live' || l.status === 'reserved'; });
    var reqs = data.requirements.filter(function (r) { return r.status === 'open'; });
    var out = reqs.map(function (r) {
      var hits = live.filter(function (l) {
        var modelOk = r.model === 'Open to options' || String(l.model).toLowerCase() === String(r.model).toLowerCase();
        var kindOk = r.kind === 'either' || r.kind === l.kind;
        return modelOk && kindOk && l.gpu_count >= Math.min(r.gpu_count * 0.5, l.min_commit || 64);
      });
      var b = r.buyer || {};
      return '<div class="xa-match"><div><b>' + num(r.gpu_count) + ' ' + esc(r.model) + '</b> for ' + esc(b.company || 'a buyer') + ' ' + tierPill(b.tier, b.score) + '<div class="xa-sub">' + esc([r.region, r.timeline, r.budget].filter(Boolean).join(', ')) + ', ' + tel(b.phone) + '</div></div><div>' +
        (hits.length ? hits.map(function (l) { var s = l.seller || {}; return '<div class="xa-hit"><span>' + esc(l.ref) + ', ' + num(l.gpu_count) + ' GPUs, ' + esc(l.available || '') + ', seller ' + esc(s.company || '—') + '</span><button class="btn btn-ghost btn-sm" data-xa-copyintro="' + r.id + '|' + l.id + '">Copy intro email</button></div>'; }).join('')
          : '<div class="xa-sub">No listed match. Source off-market, or prospect a seller in the Prospect Desk.</div>') + '</div></div>';
    }).join('');
    return '<div class="xa-panel"><div class="xa-h"><h3>Matches</h3><span class="xa-mute">Open requirements against live lots. Introduce both sides under NCNDA.</span></div>' + (out || '<p class="xa-empty">No open requirements.</p>') + '</div>';
  }

  function introEmail(rid, lid) {
    var r = data.requirements.filter(function (x) { return x.id === rid; })[0], l = data.listings.filter(function (x) { return x.id === lid; })[0];
    var b = (r && r.buyer) || {}, s = (l && l.seller) || {};
    return 'Subject: Introduction under NCNDA: ' + l.gpu_count + ' ' + l.model + ' (' + l.ref + ')\n\n' +
      'Hi ' + (b.full_name || '').split(' ')[0] + ' and ' + (s.full_name || '').split(' ')[0] + ',\n\n' +
      'As discussed with each of you, I\'m introducing ' + (b.company || 'the buyer') + ' and ' + (s.company || 'the seller') + ' on the exchange for lot ' + l.ref + ': ' + l.gpu_count + ' ' + l.model + (l.config ? ' ' + l.config : '') + ', ' + (l.region || '') + ', available ' + (l.available || 'TBC') + '.\n\n' +
      'The requirement on our side is ' + r.gpu_count + ' ' + r.model + (r.timeline ? ', ' + r.timeline : '') + '. The NCNDA is attached for both signatures. Once it\'s back, I\'ll set up a 30-minute call to walk through allocation documents and terms.\n\n' +
      'Best,\nThe Chief Negotiators';
  }

  async function render() {
    var mount = document.getElementById('exchangeMount'); if (!mount) return;
    if (!isAdmin()) { signInView(mount); return; }
    mount.innerHTML = '<p class="xa-mute">Loading the exchange</p>';
    try { await fetchAll(); } catch (e) { mount.innerHTML = '<div class="xa-gate"><h3>Could not load the exchange.</h3><p>' + esc(e.message) + '</p></div>'; return; }
    var body = { call: callView, apps: appsView, lots: lotsView, deals: dealsView, match: matchView }[view]();
    mount.innerHTML = kpis() + segs() + body;
    var c = document.getElementById('tabc-exchange');
    if (c) c.textContent = data.intros.filter(function (i) { return i.status === 'new'; }).length + data.members.filter(function (m) { return m.status === 'pending' && m.tier !== 'waitlist'; }).length;
  }

  document.addEventListener('click', async function (e) {
    var t = e.target.closest('[data-xa-view],[data-xa-member],[data-xa-lot],[data-xa-intro],[data-xa-copyintro]');
    if (!t || !document.getElementById('exchangeMount').contains(t)) return;
    try {
      if (t.dataset.xaView) { view = t.dataset.xaView; render(); return; }
      if (t.dataset.xaMember) { await X.admin.reviewMember(t.dataset.xaMember, t.dataset.to); toast(t.dataset.to === 'approved' ? 'Member approved' : 'Application declined'); }
      if (t.dataset.xaLot) { await X.admin.setListing(t.dataset.xaLot, JSON.parse(t.dataset.patch)); toast('Lot updated'); }
      if (t.dataset.xaIntro) { await X.admin.setIntro(t.dataset.xaIntro, { status: t.dataset.to }); toast('Marked call booked'); }
      if (t.dataset.xaCopyintro) { var ids = t.dataset.xaCopyintro.split('|'); await navigator.clipboard.writeText(introEmail(ids[0], ids[1])); toast('Intro email copied'); return; }
      render();
    } catch (err) { toast(err.message); }
  });
  document.addEventListener('change', async function (e) {
    var t = e.target.closest('[data-xa-istatus]'); if (!t) return;
    try { await X.admin.setIntro(t.dataset.xaIstatus, { status: t.value }); toast('Deal moved'); render(); } catch (err) { toast(err.message); }
  });

  window.TCNExchangeAdmin = { render: render };
  X.onChange(function () { var sec = document.getElementById('tab-exchange'); if (sec && !sec.classList.contains('hidden')) render(); });
  X.ready().then(function () { render(); });
  setInterval(function () { var sec = document.getElementById('tab-exchange'); if (sec && !sec.classList.contains('hidden') && view === 'call') render(); }, 60000);
})();
