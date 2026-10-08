// Admin console: Exchange tab
// The exchange is public and reads its lots from the Google Sheet, so this
// tab is a read-back of what is on the floor right now, with share links.
// Enquiries from the exchange arrive by email (Formspree), subject-tagged
// [INTRO · CALL NOW], [REQUIREMENT · CALL NOW] or [NEW LOT · REVIEW].
(function () {
  'use strict';
  var X = window.TCNX;
  if (!X) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var num = function (n) { return n == null ? '' : Number(n).toLocaleString('en-US'); };
  var toast = function (m) { if (window.TCN && window.TCN.toast) window.TCN.toast(m); };
  var base = function () { return (/^http/.test(location.origin) ? location.origin : 'https://portal.thechiefnegotiators.com') + '/'; };

  async function render() {
    var mount = document.getElementById('exchangeMount'); if (!mount) return;
    if (X.mode !== 'sheet') {
      mount.innerHTML = '<div class="xa-gate"><h3>Connect the lots sheet.</h3><p>The exchange is public and reads its lots from a Google Sheet. Publish the sheet\'s Lots tab as CSV and paste the link into <span class="kbd">exchange.lotsSheetCsvUrl</span> in <span class="kbd">static/config.js</span>. Columns and steps are in <span class="kbd">portal/EXCHANGE_SETUP.md</span>.</p></div>';
      return;
    }
    mount.innerHTML = '<p class="xa-mute">Loading the floor from the sheet</p>';
    var lots, reqs;
    try { var a = await Promise.all([X.floor(), X.demand()]); lots = a[0]; reqs = a[1]; }
    catch (e) { mount.innerHTML = '<div class="xa-gate"><h3>Could not read the sheet.</h3><p>' + esc(e.message) + '. Check that the tab is still published to the web as CSV.</p></div>'; return; }
    var c = document.getElementById('tabc-exchange'); if (c) c.textContent = lots.length;
    mount.innerHTML =
      '<div class="xa-panel"><div class="xa-h"><h3>On the floor</h3><span class="xa-mute">' + lots.length + ' lots from the sheet. Edit the sheet to add, change or hide lots; the site updates within a minute.</span></div><div class="xa-scroll"><table class="xa-t"><thead><tr><th>Lot</th><th>Size</th><th>Terms</th><th>Status</th><th></th></tr></thead><tbody>' +
      (lots.map(function (l) {
        var terms = l.price != null ? '$' + Number(l.price).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + esc(l.price_unit || '') : 'Price on request';
        return '<tr><td><b>' + esc(l.model) + '</b> ' + (l.featured ? '<span class="xa-pill priority">desk pick</span>' : '') + '<div class="xa-sub">' + esc(l.ref) + ', ' + (l.kind === 'gpuaas' ? 'GPUaaS' : 'Hardware') + (l.config ? ', ' + esc(l.config) : '') + '</div></td>' +
          '<td>' + num(l.gpu_count) + ' GPUs<div class="xa-sub">' + esc([l.region, l.available].filter(Boolean).join(', ')) + '</div></td>' +
          '<td>' + terms + '<div class="xa-sub">' + esc([l.deposit_pct ? l.deposit_pct + '% dep' : '', l.term_months ? l.term_months + ' mo' : '', 'min ' + (l.min_commit || 64)].filter(Boolean).join(', ')) + '</div></td>' +
          '<td>' + (l.status === 'reserved' ? 'Under offer' : 'Live') + '</td>' +
          '<td class="xa-btns"><button class="btn btn-ghost btn-sm" data-xa-copy="' + esc(l.ref) + '">Copy link</button><a class="btn btn-ghost btn-sm" href="' + esc(base() + '#lot=' + encodeURIComponent(l.ref)) + '" target="_blank" rel="noopener">View</a></td></tr>';
      }).join('') || '<tr><td colspan="5" class="xa-mute">No lots listed. Add rows to the sheet.</td></tr>') +
      '</tbody></table></div></div>' +
      '<div class="xa-panel" style="margin-top:18px"><div class="xa-h"><h3>Open requirements</h3><span class="xa-mute">' + (X.config.requirementsSheetCsvUrl ? reqs.length + ' from the Requirements tab.' : 'Optional: publish a Requirements tab and set exchange.requirementsSheetCsvUrl.') + '</span></div>' +
      (reqs.length ? '<div class="xa-scroll"><table class="xa-t"><thead><tr><th>Model</th><th>GPUs</th><th>Region</th><th>Timeline</th></tr></thead><tbody>' + reqs.map(function (r) {
        return '<tr><td>' + esc(r.model) + '</td><td>' + num(r.gpu_count) + '</td><td>' + esc(r.region || 'Any') + '</td><td>' + esc(r.timeline || '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '') + '</div>';
  }

  document.addEventListener('click', async function (e) {
    var t = e.target.closest('[data-xa-copy]');
    if (!t) return;
    try { await navigator.clipboard.writeText(base() + '#lot=' + encodeURIComponent(t.dataset.xaCopy)); toast('Lot link copied'); } catch (err) { toast(err.message); }
  });

  window.TCNExchangeAdmin = { render: render };
  render();
})();
