/* Availability matcher — progressive enhancement.
   The form posts everything without JS; this only adds live matching. */
(function () {
  // Everything here is build-to-suit. Positions with a committed RFS date are already
  // in motion; the rest are specified around the buyer's requirement.
  var POS = [
    { id: 'M1', qty: 36,   label: 'HGX B300',    region: 'United States', rfs: 'Q4 2026', terms: [4],     motion: true },
    { id: 'M2', qty: 40,   label: 'HGX B300',    region: 'United States', rfs: 'Q4 2026', terms: [4],     motion: true },
    { id: 'M3', qty: 38,   label: 'B300',        region: 'United States', rfs: 'Q4 2026', terms: [3,4,5], motion: true },
    { id: 'M4', qty: 128,  label: 'HGX B300',    region: 'United States', rfs: 'Q4 2026', terms: [3,4],   motion: true },
    { id: 'M5', qty: 256,  label: 'B300',        region: 'United States', rfs: 'Q4 2026', terms: [5],     motion: true },
    { id: 'M6', qty: 64,   label: 'B300 · 3 TB', region: 'Nordics',       rfs: 'Q1 2027', terms: [3],     motion: true },
    { id: 'M7', qty: 80,   label: 'B300 · 2 TB', region: 'Nordics',       rfs: 'Q1 2027', terms: [5],     motion: true },
    { id: 'M8', qty: 128,  label: 'B300',        region: 'Nordics',       rfs: 'Q1 2027', terms: [5],     motion: true },
    { id: 'R1', qty: 1728, label: 'GB300 NVL72', region: 'United States', rfs: 'On request', terms: [5],  us: true },
    { id: 'R2', qty: 2000, label: 'GB300 NVL72', region: 'United States', rfs: 'On request', terms: [5],  us: true },
    { id: 'O1', open: true, region: 'United States', label: 'Open specification · US',      rfs: 'From Q2 2027', terms: [3,4,5] },
    { id: 'O2', open: true, region: 'Nordics',       label: 'Open specification · Nordics', rfs: 'From Q2 2027', terms: [3,4,5] },
    { id: 'O3', open: true, region: 'EU',            label: 'Open specification · EU',      rfs: 'From Q2 2027', terms: [3,4,5] }
  ];
  var QMIN = { 'under-128': 1, '128-255': 128, '256-511': 256, '512-1727': 512, '1728+': 1728 };
  // Deposit scales with term — a longer commitment carries less down.
  var DEP = { 3: '30%', 4: '25–30%', 5: '20–25%' };
  function depLabel(p, term) {
    var y = parseInt(term, 10);
    if (y && p.terms.indexOf(y) > -1) return DEP[y];
    if (p.terms.length === 1) return DEP[p.terms[0]];
    return '20–30% by term';
  }

  var form = document.getElementById('qf');
  var res  = document.getElementById('res');
  var cnt  = document.getElementById('cnt');
  var mp   = document.getElementById('mp');
  var sb   = document.getElementById('sb');
  if (!form || !res) return;

  function val(name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  }

  function platMatch(sel, label) {
    if (sel === 'GB300 NVL72') return label.indexOf('GB300') > -1;
    if (sel === 'B300 class') return label.indexOf('GB300') < 0 && label.indexOf('B300') > -1;
    return true;
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' })[c]; }); }

  function note(kind, html) {
    return '<div class="mtch-note' + (kind ? ' ' + kind : '') + '">' + html + '</div>';
  }

  function render() {
    var plat = val('platform'), qty = val('qty'), region = val('region'),
        rfs = val('rfs'), term = val('term'), dep = val('deposit');

    if (!dep) {
      res.innerHTML = '<p class="mtch-empty">Answer all six and the matching builds appear here, with terms and deposit.</p>';
      cnt.textContent = '—';
      if (mp) mp.value = '';
      return;
    }
    if (!plat && !qty && !region && !rfs && !term) {
      res.innerHTML = '<p class="mtch-empty">Answer the questions and matching builds appear here.</p>';
      cnt.textContent = '—';
      if (mp) mp.value = '';
      return;
    }

    var pre = '';

    if (sb) sb.textContent = 'Send enquiry →';

    if (dep === 'Cannot place a deposit') {
      cnt.textContent = 'See reserved capacity';
      res.innerHTML = note('warn',
        '<strong>Build-to-suit carries a deposit.</strong>' +
        '<p>Every purpose-built position carries cash against the term — 30% on three years, 20–25% on five — because the operator is committing capital to your specification.</p>' +
        '<p>Send the enquiry anyway if approval is the only thing in the way. <a href="gpuaas-contract-negotiation.html">Reserved GPUaaS capacity</a> is the route that requires no deposit.</p>');
      if (mp) mp.value = 'none shown — no deposit capability';
      if (sb) sb.textContent = 'Send enquiry anyway →';
      return;
    }

    var min = QMIN[qty] || 1;
    var m = POS.filter(function (p) {
      if (region && region !== 'Either' && p.region !== region) return false;
      if (term && term !== 'Undecided' && p.terms.indexOf(parseInt(term, 10)) < 0) return false;
      if (p.open) {
        // Specification is open, so platform and scale never exclude it. Only timing does —
        // nothing can be purpose-built inside the committed-build window.
        return !rfs || rfs === 'Q2–Q3 2027' || rfs === 'Q4 2027 or later' || rfs === 'Flexible';
      }
      if (plat && plat !== 'Either' && !platMatch(plat, p.label)) return false;
      if (rfs && rfs !== 'Flexible' && p.rfs !== 'On request' && p.rfs !== rfs) return false;
      if (p.qty < min) return false;
      return true;
    });

    cnt.textContent = m.length + (m.length === 1 ? ' match' : ' matches');
    if (mp) mp.value = m.length ? m.map(function (p) { return p.open ? p.id + ' (' + p.label + ', ' + p.rfs + ')' : p.id + ' (' + p.qty + '× ' + p.label + ', ' + p.region + ', ' + p.rfs + ')'; }).join('; ') : 'none matching';

    if (!m.length) {
      res.innerHTML = pre + note('',
        '<strong>Nothing matching today.</strong><p>Common, and not the end of it — builds and allocation surface weekly and rarely reach an open market. Send the requirement and we will work it against what is moving.</p>');
      return;
    }

    var html = pre + '<ul class="mtch-list">' + m.map(function (p) {
      if (p.open) {
        return '<li class="is-bts">' +
          '<div class="mtch-h"><span class="mtch-p">' + esc(p.label) + '</span></div>' +
          '<dl class="mtch-d">' +
            '<div><dt>Scale</dt><dd>' + (p.minQty ? p.minQty.toLocaleString() + '+' : 'Any') + '</dd></div>' +
            '<div><dt>RFS</dt><dd>' + esc(p.rfs) + '</dd></div>' +
            '<div><dt>Term</dt><dd>' + p.terms.map(function (y) { return y + ' yr'; }).join(' / ') + '</dd></div>' +
            '<div><dt>Down</dt><dd>' + depLabel(p, term) + '</dd></div>' +
          '</dl>' +
          '<span class="flag">Specify to order</span>' +
        '</li>';
      }
      return '<li>' +
        '<div class="mtch-h"><span class="mtch-qty">' + p.qty.toLocaleString() + ' ×</span> <span class="mtch-p">' + esc(p.label) + '</span></div>' +
        '<dl class="mtch-d">' +
          '<div><dt>Region</dt><dd>' + esc(p.region) + '</dd></div>' +
          '<div><dt>RFS</dt><dd>' + esc(p.rfs) + '</dd></div>' +
          '<div><dt>Term</dt><dd>' + p.terms.map(function (y) { return y + ' yr'; }).join(' / ') + '</dd></div>' +
          '<div><dt>Down</dt><dd>' + depLabel(p, term) + '</dd></div>' +
        '</dl>' +
        (p.motion ? '<span class="flag">In motion</span>' : '') +
        (p.us ? '<span class="flag">US offtaker only</span>' : '') +
      '</li>';
    }).join('') + '</ul>';

    html += note('ok', '<strong>Rates and sites from the partner.</strong><p>We hold no inventory and set no prices. The exact $/GPU-hour, the specific site and a confirmed RFS date come from the operator building it, within one business day of the enquiry.</p>');
    res.innerHTML = html;
  }

  form.addEventListener('change', render);
  render();
})();
