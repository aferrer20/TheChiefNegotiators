/* The Chief Negotiators — GPU power & rack estimator.
   Planning arithmetic from published system power figures only. No pricing,
   no inventory. Everything runs in the browser; nothing is sent anywhere. */
(function () {
  var form = document.getElementById('est-form');
  if (!form) return;

  // kW per system (8-GPU board) or per rack (NVL72). Approximate published maxima.
  var P = {
    h100:  { name: 'NVIDIA HGX H100',   per: 8,  kw: 10.2, blackwell: false, rack: false, note: 'DGX H100 ~10.2 kW max' },
    h200:  { name: 'NVIDIA HGX H200',   per: 8,  kw: 10.2, blackwell: false, rack: false, note: 'DGX H200 ~10.2 kW max' },
    b200:  { name: 'NVIDIA HGX B200',   per: 8,  kw: 14.3, blackwell: true,  rack: false, note: 'DGX B200 ~14.3 kW max' },
    b300:  { name: 'NVIDIA HGX B300',   per: 8,  kw: 14.5, blackwell: true,  rack: false, note: 'DGX B300 ~14.5 kW' },
    gb200: { name: 'NVIDIA GB200 NVL72', per: 72, kw: 120,  blackwell: true,  rack: true,  note: '~120 kW per rack, nominal' },
    gb300: { name: 'NVIDIA GB300 NVL72', per: 72, kw: 135,  blackwell: true,  rack: true,  note: '~120–140 kW per rack; 135 kW used' }
  };

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    gpu: $('est-gpu'), n: $('est-n'), pue: $('est-pue'), pueV: $('est-pue-v'),
    dens: $('est-dens'), ovh: $('est-ovh'), ovhV: $('est-ovh-v'),
    it: $('o-it'), fac: $('o-fac'), racks: $('o-racks'), sys: $('o-sys'),
    per: $('o-per'), cool: $('o-cool'), mwh: $('o-mwh'), basis: $('o-basis'),
    fit: $('o-fit'), warn: $('o-warn'), mail: $('o-mail')
  };

  function fmt(x, d) { return x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }

  function cooling(kwPerRack) {
    if (kwPerRack <= 20) return 'Conventional air';
    if (kwPerRack <= 45) return 'Air with containment or rear-door heat exchange';
    if (kwPerRack <= 80) return 'Rear-door heat exchange or direct-to-chip liquid';
    return 'Direct-to-chip liquid, CDU and facility water';
  }

  function run(track) {
    var p = P[el.gpu.value] || P.b300;
    var n = Math.max(1, Math.min(200000, parseInt(el.n.value, 10) || 0));
    var pue = parseFloat(el.pue.value);
    var dens = parseFloat(el.dens.value);
    var ovh = parseFloat(el.ovh.value) / 100;
    el.pueV.textContent = pue.toFixed(2);
    el.ovhV.textContent = Math.round(ovh * 100) + '%';

    var warn = [];
    var units = Math.ceil(n / p.per);
    var gpus = units * p.per;
    if (gpus !== n) warn.push('Rounded up to ' + fmt(gpus, 0) + ' GPUs — ' + (p.rack ? 'NVL72 is sold as whole 72-GPU racks.' : 'systems ship as 8-GPU boards.'));

    var computeKw = units * p.kw;
    var itKw = computeKw * (1 + ovh);
    var facKw = itKw * pue;
    var racks, perRack, rackKw;

    if (p.rack) {
      racks = units;
      perRack = '72 GPUs (1 rack = 1 NVLink domain)';
      rackKw = p.kw;
      if (dens < p.kw) warn.push('A ' + p.name.replace('NVIDIA ', '') + ' rack draws ~' + p.kw + ' kW on its own; your ' + dens + ' kW density cap cannot host it. The facility has to be specified to the rack, not the other way round.');
    } else {
      var fit = Math.floor(dens / p.kw);
      if (fit < 1) {
        warn.push('At ' + dens + ' kW per rack, not even one ' + p.kw + ' kW system fits. Assumed one system per rack — the hall needs higher density.');
        fit = 1;
      }
      fit = Math.min(fit, 8);
      racks = Math.ceil(units / fit);
      perRack = fit + ' system' + (fit > 1 ? 's' : '') + ' · ' + fit * 8 + ' GPUs';
      rackKw = fit * p.kw;
    }

    el.it.innerHTML = itKw >= 1000 ? fmt(itKw / 1000, 2) + '<small>MW</small>' : fmt(itKw, 0) + '<small>kW</small>';
    el.fac.innerHTML = facKw >= 1000 ? fmt(facKw / 1000, 2) + '<small>MW</small>' : fmt(facKw, 0) + '<small>kW</small>';
    el.racks.innerHTML = fmt(racks, 0) + '<small>compute</small>';
    el.sys.innerHTML = fmt(units, 0) + '<small>' + (p.rack ? 'NVL72 racks' : '8-GPU systems') + '</small>';
    el.per.textContent = perRack + ' · ~' + fmt(rackKw, 1) + ' kW';
    el.cool.textContent = cooling(rackKw);
    el.mwh.textContent = fmt(facKw * 8.76, 0) + ' MWh';
    el.basis.textContent = p.note + ' · +' + Math.round(ovh * 100) + '% network & storage · PUE ' + pue.toFixed(2);
    el.warn.textContent = warn.join(' ');

    var facMw = facKw / 1000;
    var inScope = p.blackwell && (gpus >= 512 || facMw >= 1);
    if (inScope) {
      el.fit.innerHTML = '<strong>Within desk scope</strong>Current-generation Blackwell at ' + fmt(gpus, 0) + ' GPUs and ~' + fmt(facMw, 2) + ' MW of facility load. Send us this requirement and we will put real capacity, allocation and terms against it.';
    } else if (!p.blackwell) {
      el.fit.innerHTML = '<strong>Hardware allocation route</strong>Hopper-generation requirements are worked as hardware allocation and reallocation rather than GPUaaS or reserved clusters. We can still source the hardware and the facility to land it.';
    } else {
      el.fit.innerHTML = '<strong>Below the reserved-cluster floor</strong>GPUaaS and reserved clusters start at 512 GPUs or 1 MW. Below that we would add cost without adding much — though hardware allocation runs wider, and we will say plainly which route fits.';
    }

    var spec = p.name + ' × ' + fmt(gpus, 0) + ' GPUs\nIT load: ~' + fmt(itKw, 0) + ' kW\nFacility load (PUE ' + pue.toFixed(2) + '): ~' + fmt(facKw, 0) + ' kW\nCompute racks: ' + racks + ' at ~' + fmt(rackKw, 1) + ' kW each\nCooling: ' + cooling(rackKw) + '\n\nTarget live date:\nPreferred region:\nBuy / lease / reserved:\n';
    el.mail.href = 'mailto:sales@thechiefnegotiators.com?subject=' + encodeURIComponent('Requirement: ' + p.name + ' × ' + fmt(gpus, 0)) + '&body=' + encodeURIComponent(spec);

    // shareable state
    try {
      var q = '?gpu=' + el.gpu.value + '&n=' + n + '&pue=' + pue.toFixed(2) + '&kw=' + dens + '&ovh=' + Math.round(ovh * 100);
      history.replaceState(null, '', location.pathname + q);
    } catch (e) {}

    if (track && window.gtag) {
      window.gtag('event', 'estimator_run', { platform: el.gpu.value, gpus: gpus, facility_mw: +facMw.toFixed(2), in_scope: inScope });
    }
  }

  // restore from URL
  try {
    var sp = new URLSearchParams(location.search);
    if (sp.get('gpu') && P[sp.get('gpu')]) el.gpu.value = sp.get('gpu');
    if (sp.get('n')) el.n.value = parseInt(sp.get('n'), 10) || el.n.value;
    if (sp.get('pue')) el.pue.value = Math.min(1.8, Math.max(1.05, parseFloat(sp.get('pue')) || 1.3));
    if (sp.get('kw')) {
      var o = el.dens.querySelector('option[value="' + parseInt(sp.get('kw'), 10) + '"]');
      if (o) el.dens.value = o.value;
    }
    if (sp.get('ovh')) el.ovh.value = Math.min(25, Math.max(0, parseInt(sp.get('ovh'), 10) || 10));
  } catch (e) {}

  var debounce;
  form.addEventListener('input', function () {
    run(false);
    clearTimeout(debounce);
    debounce = setTimeout(function () { run(true); }, 1500);
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); run(true); });

  // sensible density default when switching to rack-scale
  el.gpu.addEventListener('change', function () {
    var p = P[el.gpu.value];
    if (p && p.rack && parseFloat(el.dens.value) < p.kw) el.dens.value = '150';
    run(false);
  });

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-est-cta]');
    if (a && window.gtag) window.gtag('event', 'estimator_cta', { cta: a.getAttribute('data-est-cta'), platform: el.gpu.value });
  });

  run(false);
})();
