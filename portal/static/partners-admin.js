// Admin console: Partners tab
// The partner ecosystem shown on the public website — the homepage
// Ecosystem section and /partners. Every change saves to Supabase and
// appears on the site the next time a visitor loads the page.
// Uses the same admin sign-in as the Exchange tab (one session).
// Website partners live in site_partners. The CRM's own partners table is
// only read (name, org, company, region, status) so you can publish a CRM
// partner in one click; its private fields never reach the website.
(function () {
  'use strict';
  var X = window.TCNX;
  if (!X || !X.admin || !X.admin.partners) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var toast = function (m) { if (window.TCN && window.TCN.toast) window.TCN.toast(m); else console.log(m); };
  var SITE = 'https://www.thechiefnegotiators.com';
  var LAYERS = [['compute', 'Compute'], ['capacity', 'Capacity'], ['power', 'Power'], ['cooling', 'Cooling'], ['network', 'Network'], ['licensing', 'Licensing'], ['finance', 'Finance'], ['other', 'Other']];
  var LAYER = {}; LAYERS.forEach(function (l) { LAYER[l[0]] = l[1]; });

  var list = null, crm = null, editing = null, busy = false, error = '', loaded = false;
  function crmLabel(c) { return c.company || c.org || c.name || c.id; }
  function mount() { return document.getElementById('partnersMount'); }

  function slugify(s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'partner'; }
  function https(v) {
    v = String(v || '').trim();
    if (!v) return null;
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    return v.replace(/^http:\/\//i, 'https://');
  }

  async function load() {
    error = '';
    if (!X.admin.configured()) { list = null; loaded = true; return render(); }
    try {
      var s = await X.admin.session();
      if (!s) { list = null; loaded = true; return render(); }
      var r = await Promise.all([X.admin.partners(), X.admin.crmPartners()]);
      list = r[0]; crm = r[1];
    } catch (e) { error = e.message; list = null; }
    loaded = true;
    render();
  }

  async function run(op, msg) {
    if (busy) return;
    busy = true; render();
    try { await op(); list = await X.admin.partners(); editing = null; toast(msg || 'Saved'); }
    catch (e) { toast(e.message); }
    busy = false; render();
  }

  function field(name, label, value, opts) {
    opts = opts || {};
    var id = 'pa_' + name, cls = 'field' + (opts.span ? ' span-' + opts.span : '');
    var req = opts.req ? ' <span class="req">*</span>' : '';
    var input;
    if (opts.options) {
      input = '<select id="' + id + '" name="' + name + '">' + opts.options.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (String(value == null ? '' : value) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select>';
    } else if (opts.textarea) {
      input = '<textarea id="' + id + '" name="' + name + '" maxlength="400" style="min-height:80px" placeholder="' + esc(opts.ph || '') + '">' + esc(value) + '</textarea>';
    } else if (opts.check) {
      return '<div class="' + cls + '"><label for="' + id + '">' + label + '</label><label style="display:flex;gap:8px;align-items:center;font-size:14px;letter-spacing:0;text-transform:none"><input id="' + id + '" name="' + name + '" type="checkbox" style="width:auto"' + (value ? ' checked' : '') + '> ' + esc(opts.text || '') + '</label></div>';
    } else {
      input = '<input id="' + id + '" name="' + name + '" type="' + (opts.type || 'text') + '" value="' + esc(value) + '" placeholder="' + esc(opts.ph || '') + '"' + (opts.req ? ' required' : '') + '>';
    }
    return '<div class="' + cls + '"><label for="' + id + '">' + label + req + '</label>' + input + '</div>';
  }

  function form() {
    var p = editing.index >= 0 ? list[editing.index] : Object.assign({ layer: 'other', status: 'live', sort: 100 }, editing.seed || {});
    var link = crm && crm.length ? field('crm_id', 'Linked CRM partner', p.crm_id || '', { span: 2, options: [['', 'Not linked']].concat(crm.map(function (c) { return [c.id, crmLabel(c) + (c.region ? ' · ' + c.region : '')]; })) })
      : '<input type="hidden" name="crm_id" value="' + esc(p.crm_id || '') + '">';
    return '<div class="sku-form" style="margin-bottom:18px"><h3 style="font-family:var(--mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--copper);margin:0 0 18px">// ' + (editing.index >= 0 ? 'Edit ' + esc(p.name) : 'New partner') + '</h3>' +
      '<p class="xa-mute" style="margin:-8px 0 16px">Everything here is public on the website. Only list partners who have agreed to be named.</p>' +
      '<form id="paForm"><div class="sku-form-grid">' +
      field('name', 'Name', p.name, { req: 1, ph: 'Company name' }) +
      field('layer', 'Layer', p.layer, { options: LAYERS }) +
      field('region', 'Region', p.region, { ph: 'Global, United States, EMEA' }) +
      field('website', 'Website', p.website, { ph: 'https://' }) +
      field('logo_url', 'Logo URL (optional)', p.logo_url, { span: 2, ph: 'https://… (PNG or SVG, transparent background)' }) +
      field('sort', 'Order', p.sort, { type: 'number', ph: '100 (lower shows first)' }) +
      field('status', 'Status', p.status, { options: [['live', 'Live (on the website)'], ['hidden', 'Hidden']] }) +
      field('featured', 'Featured', p.featured, { check: 1, text: 'Show on the homepage' }) +
      link +
      field('blurb', 'What they do (public, 400 characters max)', p.blurb, { textarea: 1, span: 4, ph: 'One or two plain sentences on what they do and why it matters to a buyer or operator.' }) +
      '</div><div style="display:flex;gap:10px;margin-top:20px;padding-top:18px;border-top:1px solid var(--line)"><button class="btn btn-primary" type="submit"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Saving' : 'Save partner') + '</button><button class="btn btn-ghost" type="button" data-pa="cancel">Cancel</button></div></form></div>';
  }

  function table() {
    var live = list.filter(function (p) { return p.status === 'live'; });
    var feat = live.filter(function (p) { return p.featured; });
    return '<div class="xa-panel"><div class="xa-h"><h3>Partners</h3><span class="xa-mute">' + live.length + ' on the website, ' + feat.length + ' featured on the homepage' + (list.length > live.length ? ', ' + (list.length - live.length) + ' hidden' : '') + '</span></div>' +
      (list.length ? '<div class="xa-scroll"><table class="xa-t"><thead><tr><th>Partner</th><th>Layer</th><th>Order</th><th>Status</th><th></th></tr></thead><tbody>' + list.map(function (p, i) {
        return '<tr' + (p.status !== 'live' ? ' style="opacity:.55"' : '') + '><td><b>' + esc(p.name) + '</b> ' + (p.featured ? '<span class="xa-pill priority">homepage</span>' : '') + (p.crm_id ? ' <span class="xa-pill">CRM linked</span>' : '') +
          '<div class="xa-sub">' + esc([p.region, p.website ? p.website.replace(/^https:\/\//, '').replace(/\/$/, '') : ''].filter(Boolean).join(' · ')) + '</div></td>' +
          '<td>' + esc(LAYER[p.layer] || p.layer) + '</td><td>' + esc(p.sort) + '</td><td>' + (p.status === 'live' ? 'Live' : 'Hidden') + '</td>' +
          '<td class="xa-btns"><button class="btn btn-ghost btn-sm" data-pa="edit" data-i="' + i + '">Edit</button>' +
          '<button class="btn btn-ghost btn-sm" data-pa="feature" data-i="' + i + '">' + (p.featured ? 'Unfeature' : 'Feature') + '</button>' +
          '<button class="btn btn-ghost btn-sm" data-pa="toggle" data-i="' + i + '">' + (p.status === 'live' ? 'Hide' : 'Show') + '</button>' +
          '<button class="btn btn-ghost btn-sm" data-pa="del" data-i="' + i + '">Delete</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="xa-mute" style="padding:16px 0">No partners yet. Add the first one.</p>') + '</div>';
  }

  // CRM partners not yet on the website, each with a Publish button.
  // Only name / org / company / region are read from the CRM — never its private fields.
  function crmPanel() {
    if (crm === null) return '<p class="xa-mute" style="margin-top:18px">Your CRM partner list is not readable with this login, so linking is off. You can still add website partners by hand.</p>';
    var linked = {}; list.forEach(function (p) { if (p.crm_id) linked[p.crm_id] = true; });
    var todo = crm.filter(function (c) { return !linked[c.id]; });
    return '<div class="xa-panel" style="margin-top:18px"><div class="xa-h"><h3>From your CRM</h3><span class="xa-mute">' + crm.length + ' CRM partners, ' + (crm.length - todo.length) + ' on the website. Publishing copies only the name and region; you add the public description.</span></div>' +
      (todo.length ? '<div class="xa-scroll"><table class="xa-t"><thead><tr><th>CRM partner</th><th>Region</th><th>CRM status</th><th></th></tr></thead><tbody>' + todo.map(function (c) {
        var i = crm.indexOf(c);
        return '<tr><td><b>' + esc(crmLabel(c)) + '</b>' + (c.name && c.name !== crmLabel(c) ? '<div class="xa-sub">' + esc(c.name) + '</div>' : '') + '</td><td>' + esc(c.region || '') + '</td><td>' + esc(c.status || '') + '</td>' +
          '<td class="xa-btns"><button class="btn btn-ghost btn-sm" data-pa="publish" data-i="' + i + '">Publish to website</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="xa-mute" style="padding:16px 0">Every CRM partner is already on the website.</p>') + '</div>';
  }

  function render() {
    var m = mount(); if (!m) return;
    var c = document.getElementById('tabc-partners');
    if (c) c.textContent = list ? list.filter(function (p) { return p.status === 'live'; }).length : '0';
    if (!loaded) { m.innerHTML = '<p class="xa-mute">Loading…</p>'; return; }
    if (!list) {
      m.innerHTML = '<div class="xa-gate"><h3>' + (X.admin.configured() ? 'Sign in first' : 'Connect Supabase') + '</h3><p>' +
        (X.admin.configured()
          ? 'Partners use the same admin sign-in as the Exchange. Sign in on the Exchange tab, then come back here.'
          : 'Add the Supabase anon (publishable) key to <span class="kbd">exchange.supabaseAnonKey</span> in <span class="kbd">static/config.js</span> and run <span class="kbd">portal/supabase-exchange.sql</span>. The website partner section reads the same key.') +
        '</p>' + (error ? '<p class="xa-mute" style="color:#B4532A">' + esc(error) + '</p>' : '') +
        (X.admin.configured() ? '<div style="display:flex;gap:10px;margin-top:12px"><button class="btn btn-primary btn-sm" data-pa="goto-exchange">Go to sign-in</button><button class="btn btn-ghost btn-sm" data-pa="reload">I have signed in</button></div>' : '') + '</div>';
      return;
    }
    m.innerHTML = '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px"><button class="btn btn-primary btn-sm" data-pa="add">Add partner</button>' +
      '<a class="btn btn-ghost btn-sm" href="' + SITE + '/partners" target="_blank" rel="noopener">View on the website</a>' +
      '<span class="xa-mode">' + (busy ? 'Saving' : 'Changes are live on the website as soon as they save') + '</span></div>' +
      (editing ? form() : '') + table() + crmPanel();
  }

  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!mount() || !mount().contains(f) || f.id !== 'paForm') return;
    e.preventDefault();
    var fd = new FormData(f), v = {};
    fd.forEach(function (val, k) { v[k] = String(val).trim(); });
    v.featured = f.querySelector('[name=featured]').checked;
    if (!v.name) { toast('Name is required'); return; }
    v.website = https(v.website);
    v.logo_url = https(v.logo_url);
    v.sort = parseInt(v.sort, 10); if (!isFinite(v.sort)) v.sort = 100;
    ['blurb', 'region', 'crm_id'].forEach(function (k) { if (!v[k]) v[k] = null; });
    var i = editing.index;
    var row = i >= 0 ? Object.assign({}, list[i], v) : Object.assign(v, { slug: slugify(v.name) });
    run(function () { return X.admin.savePartner(row); }, i >= 0 ? 'Partner updated' : 'Partner added');
  });

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-pa]');
    if (!t || !mount() || !mount().contains(t)) return;
    e.preventDefault();
    var a = t.dataset.pa, i = +t.dataset.i, p = list && list[i];
    if (a === 'goto-exchange') { var b = document.querySelector('.admin-tab[data-tab=exchange]'); if (b) b.click(); return; }
    if (a === 'reload') { loaded = false; render(); return load(); }
    if (a === 'cancel') { editing = null; return render(); }
    if (a === 'add') { editing = { index: -1 }; return render(); }
    if (a === 'edit') { editing = { index: i }; return render(); }
    if (a === 'publish') {
      var c = crm[i];
      editing = { index: -1, seed: { name: crmLabel(c), region: c.region || '', crm_id: c.id } };
      render();
      return window.scrollTo({ top: mount().getBoundingClientRect().top + scrollY - 90, behavior: 'smooth' });
    }
    if (a === 'feature') return run(function () { return X.admin.savePartner({ id: p.id, featured: !p.featured }); }, p.featured ? 'Removed from homepage' : 'Featured on homepage');
    if (a === 'toggle') return run(function () { return X.admin.savePartner({ id: p.id, status: p.status === 'live' ? 'hidden' : 'live' }); }, p.status === 'live' ? 'Hidden from the website' : 'Live on the website');
    if (a === 'del' && confirm('Delete ' + p.name + '? To take it off the website but keep it, use Hide instead.')) run(function () { return X.admin.deletePartner(p.id); }, 'Partner deleted');
  });

  window.TCNPartnersAdmin = { render: function () { if (!loaded || !list) load(); else render(); } };
  load();
})();
