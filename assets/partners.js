/* The Chief Negotiators — live partner ecosystem.
   Partners are managed in the desk console (portal/admin -> Partners tab) and
   stored in Supabase. This reads the live ones and renders them into any
   [data-partners] container: "featured" (homepage) or "all" (/partners).
   The Supabase URL and public key come from portal/static/config.js, so there
   is one place to set them. If anything fails, the static markup already in
   the container stays as it is. */
(function () {
  var hosts = document.querySelectorAll('[data-partners]');
  if (!hosts.length) return;

  var LAYER = { compute: 'Compute', capacity: 'Capacity', power: 'Power', cooling: 'Cooling', network: 'Network', licensing: 'Licensing', finance: 'Finance', other: 'Ecosystem' };
  var ORDER = ['compute', 'capacity', 'power', 'cooling', 'network', 'licensing', 'finance', 'other'];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function safeUrl(u) { return /^https:\/\/[^\s"'<>]+$/i.test(u || '') ? u : null; }

  function card(p) {
    var url = safeUrl(p.website);
    var c = el(url ? 'a' : 'div', 'card partner-card');
    if (url) { c.href = url; c.target = '_blank'; c.rel = 'noopener noreferrer'; }
    var top = el('div', 'partner-top');
    var logo = safeUrl(p.logo_url);
    if (logo) {
      var img = el('img', 'partner-logo');
      img.src = logo; img.alt = p.name + ' logo'; img.loading = 'lazy'; img.decoding = 'async';
      img.onerror = function () { img.remove(); };
      top.appendChild(img);
    }
    top.appendChild(el('span', 'k', LAYER[p.layer] || 'Ecosystem'));
    c.appendChild(top);
    c.appendChild(el('h3', null, p.name));
    if (p.blurb) c.appendChild(el('p', null, p.blurb));
    var meta = [p.region, url ? url.replace(/^https:\/\/(www\.)?/, '').replace(/\/.*$/, '') : ''].filter(Boolean).join(' · ');
    c.appendChild(el('span', 'go', meta || 'Partner'));
    return c;
  }

  function grid(list) {
    var g = el('div', 'cards partner-grid');
    list.forEach(function (p, i) { var c = card(p); c.classList.add('stg'); c.style.setProperty('--i', Math.min(i, 10)); g.appendChild(c); });
    return g;
  }

  function stamp(host, list) {
    var latest = list.reduce(function (m, p) { var t = Date.parse(p.updated_at || p.created_at || 0) || 0; return t > m ? t : m; }, 0);
    if (!latest) return;
    var txt = 'Directory updated ' + new Date(latest).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    document.querySelectorAll('[data-partners-updated]').forEach(function (s) { s.textContent = txt; });
  }

  function schema(list) {
    var ld = {
      '@context': 'https://schema.org', '@type': 'ItemList', name: 'The Chief Negotiators partner ecosystem',
      itemListElement: list.map(function (p, i) {
        var o = { '@type': 'Organization', name: p.name };
        if (p.blurb) o.description = p.blurb;
        if (safeUrl(p.website)) o.url = p.website;
        if (safeUrl(p.logo_url)) o.logo = p.logo_url;
        return { '@type': 'ListItem', position: i + 1, item: o };
      })
    };
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(ld);
    document.head.appendChild(s);
  }

  function render(list) {
    hosts.forEach(function (host) {
      var mode = host.getAttribute('data-partners');
      var items = mode === 'featured' ? list.filter(function (p) { return p.featured; }) : list;
      if (!items.length) return; // keep the static fallback
      host.innerHTML = '';
      if (mode === 'all') {
        ORDER.forEach(function (layer) {
          var group = items.filter(function (p) { return (p.layer || 'other') === layer; });
          if (!group.length) return;
          var h = el('h2', 'stbl-h');
          h.appendChild(el('span', null, String(group.length).padStart(2, '0')));
          h.appendChild(document.createTextNode(' ' + (LAYER[layer] || 'Ecosystem')));
          host.appendChild(h);
          host.appendChild(grid(group));
        });
        schema(items);
      } else {
        host.appendChild(grid(items.slice(0, 6)));
      }
      stamp(host, items);
    });
  }

  function fetchPartners(cfg) {
    var X = (cfg && cfg.exchange) || {};
    if (!X.supabaseUrl || !X.supabaseAnonKey || !window.fetch) return;
    var url = X.supabaseUrl.replace(/\/$/, '') + '/rest/v1/site_partners?select=name,slug,layer,blurb,website,logo_url,region,featured,updated_at,created_at&status=eq.live&order=sort.asc,name.asc';
    fetch(url, { headers: { apikey: X.supabaseAnonKey, Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (list) { if (Array.isArray(list) && list.length) render(list); })
      .catch(function () {});
  }

  if (window.TCN_CONFIG) return fetchPartners(window.TCN_CONFIG);
  var s = document.createElement('script');
  s.src = '/portal/static/config.js';
  s.async = true;
  s.onload = function () { fetchPartners(window.TCN_CONFIG); };
  document.head.appendChild(s);
})();
