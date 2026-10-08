// The Chief Negotiators Exchange — data layer
// The exchange is public: no accounts, no sign-in.
//   Lots and open requirements are loaded in the desk console (admin.html,
//   Exchange tab) and stored by the Netlify function at config.exchange.floorEndpoint.
//   Every enquiry from the page goes to the sales inbox through Formspree.
(function () {
  'use strict';

  var CFG = window.TCN_CONFIG || {};
  var X = CFG.exchange || {};
  var ENDPOINT = X.floorEndpoint || '/.netlify/functions/exchange';
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

  // One request serves both floor() and demand() during a refresh.
  var last = null, lastAt = 0, good = null;
  function load() {
    if (last && Date.now() - lastAt < 3000) return last;
    lastAt = Date.now();
    last = fetch(ENDPOINT, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('Floor returned ' + r.status); return r.json(); })
      .then(function (d) { good = d; return d; }, function (e) { console.error(e); if (good) return good; throw e; });
    return last;
  }
  function sortLots(a) {
    return a.map(function (l, i) { return Object.assign({ id: l.ref, _row: i }, l); })
      .sort(function (x, y) { return (!!y.featured - !!x.featured) || ((x.status === 'reserved') - (y.status === 'reserved')) || (x._row - y._row); });
  }

  // Admin calls, used by the console. The password goes in a header and is checked server-side.
  async function adminCall(pw, body) {
    var r = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-password': pw }, body: JSON.stringify(body) });
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) { var e = new Error(d.error || ('Request failed (' + r.status + ')')); e.status = r.status; e.fromFunction = !!d.error; e.current = d.current; throw e; }
    return d;
  }

  var api = {
    mode: 'live',
    ready: function () { return Promise.resolve(); },
    floor: async function () { return sortLots(((await load()).lots) || []); },
    demand: async function () { return ((await load()).requirements || []).map(function (r) { return Object.assign({}, r); }); },
    notify: notify,
    admin: {
      load: function (pw) { return adminCall(pw, { action: 'load' }); },
      save: function (pw, data, base) { return adminCall(pw, { action: 'save', data: data, base: base }); },
    },
  };

  // Keep the floor current while the page is open.
  var every = Math.max(Number(X.refreshMs) || 60000, 15000);
  setInterval(function () { if (!document.hidden) emit(); }, every);

  api.onChange = function (fn) { listeners.push(fn); };
  api.config = X;
  api.bookingLink = X.bookingLink || (CFG.contact && CFG.contact.bookingLink) || '';
  window.TCNX = api;
})();
