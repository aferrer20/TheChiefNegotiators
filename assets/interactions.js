/* The Chief Negotiators — interaction layer.
   Progressive enhancement only: every effect degrades to "just show the content"
   if this script fails, is blocked, or the visitor prefers reduced motion. */
(function () {
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- scroll reveal + stat count-up ---------- */
  (function reveal() {
    var targets = document.querySelectorAll('main .sec, main .band, main .ctab, main header.phero');
    if (!targets.length || !('IntersectionObserver' in window)) return;
    if (reduced) return; // leave everything at its natural, fully-visible state

    var pending = Array.prototype.slice.call(targets);

    function show(el) {
      var i = pending.indexOf(el);
      if (i === -1) return;
      pending.splice(i, 1);
      requestAnimationFrame(function () {
        el.style.transition = 'opacity .8s cubic-bezier(.16,.8,.24,1), transform .8s cubic-bezier(.16,.8,.24,1)';
        el.style.opacity = '1';
        el.style.transform = 'none';
        el.classList.add('is-in');
      });
      countUp(el);
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        show(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -8% 0px' });

    targets.forEach(function (el) {
      el.classList.add('rv');
      var groups = el.querySelectorAll('.cards, .rows, .dlist, .pol, .specs, .tiers, .geo, .faq, .std-grid ul');
      groups.forEach(function (g) {
        Array.prototype.forEach.call(g.children, function (c, i) {
          c.classList.add('stg');
          c.style.setProperty('--i', Math.min(i, 10));
        });
      });
      el.style.opacity = '0';
      el.style.transform = 'translateY(22px)';
      io.observe(el);
    });

    // Safety net: crawlers, screenshot/PDF tools and print views never scroll.
    // Nothing stays hidden longer than this, no matter what.
    setTimeout(function () {
      io.disconnect();
      pending.slice().forEach(show);
    }, 2200);
  })();

  function countUp(scope) {
    var nodes = scope.querySelectorAll('.plate-v');
    nodes.forEach(function (node) {
      if (node.dataset.counted) return;
      var m = /^(\d[\d,]*)(?!-)/.exec(node.textContent);
      if (!m) return;
      var target = parseInt(m[1].replace(/,/g, ''), 10);
      if (!target || target > 100000) return;
      node.dataset.counted = '1';
      var rest = node.textContent.slice(m[1].length);
      var start = performance.now(), dur = 900;
      function tick(now) {
        var p = Math.min(1, (now - start) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        var val = Math.round(target * eased);
        node.textContent = val.toLocaleString() + rest;
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  /* ---------- cursor-reactive spotlight (.card, .plate) + tilt (.plate only) ---------- */
  (function pointerFX() {
    if (reduced || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var active = null, pending = false, lastX = 0, lastY = 0;

    function apply() {
      pending = false;
      if (!active) return;
      var r = active.rect;
      var x = ((lastX - r.left) / r.width) * 100;
      var y = ((lastY - r.top) / r.height) * 100;
      active.el.style.setProperty('--mx', x + '%');
      active.el.style.setProperty('--my', y + '%');
      if (active.tilt) {
        var rx = ((y - 50) / 50) * -5;
        var ry = ((x - 50) / 50) * 5;
        active.el.style.transform = 'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
      }
    }

    function onMove(e) {
      var el = e.target.closest('.card, .plate');
      if (!el) {
        if (active) { if (active.tilt) active.el.style.transform = ''; active = null; }
        return;
      }
      if (!active || active.el !== el) {
        if (active && active.tilt) active.el.style.transform = '';
        active = { el: el, rect: el.getBoundingClientRect(), tilt: el.classList.contains('plate') };
      }
      lastX = e.clientX; lastY = e.clientY;
      if (!pending) { pending = true; requestAnimationFrame(apply); }
    }

    document.addEventListener('pointermove', onMove, { passive: true });
    var scrollPending = false;
    window.addEventListener('scroll', function () {
      if (!active || scrollPending) return;
      scrollPending = true;
      requestAnimationFrame(function () {
        scrollPending = false;
        if (active) active.rect = active.el.getBoundingClientRect();
      });
    }, { passive: true });
  })();

  /* ---------- magnetic buttons ---------- */
  (function magnetic() {
    if (reduced || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var els = document.querySelectorAll('.btn-solid, .btn-out, .nav-cta');
    els.forEach(function (el) {
      var rect = null, pending = false, cx = 0, cy = 0;
      function apply() {
        pending = false;
        if (!rect) return;
        var dx = (cx - (rect.left + rect.width / 2)) * 0.18;
        var dy = (cy - (rect.top + rect.height / 2)) * 0.28;
        el.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
      }
      el.addEventListener('mouseenter', function () { rect = el.getBoundingClientRect(); });
      el.addEventListener('mousemove', function (e) {
        cx = e.clientX; cy = e.clientY;
        if (!pending) { pending = true; requestAnimationFrame(apply); }
      }, { passive: true });
      el.addEventListener('mouseleave', function () {
        el.style.transition = 'transform .4s cubic-bezier(.16,.8,.24,1)';
        el.style.transform = '';
        setTimeout(function () { el.style.transition = ''; }, 400);
      });
    });
  })();

  /* ---------- scroll progress + nav state ---------- */
  (function scrollState() {
    var nav = document.querySelector('.nav');
    var bar = null;
    if (!reduced) {
      bar = document.createElement('div');
      bar.className = 'scrollbar';
      bar.setAttribute('aria-hidden', 'true');
      document.body.appendChild(bar);
    }
    var pending = false;
    function update() {
      pending = false;
      var y = window.scrollY || document.documentElement.scrollTop;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.setProperty('--sp', max > 0 ? Math.min(1, y / max).toFixed(4) : 0);
      if (nav) nav.classList.toggle('is-scrolled', y > 8);
    }
    window.addEventListener('scroll', function () {
      if (!pending) { pending = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  })();

  /* ---------- deal desk terminal (homepage hero) ----------
     Rows are illustrative workstreams moving through the four-step method.
     The static markup is the no-JS / crawler state; this only animates it. */
  (function desk() {
    var root = document.querySelector('[data-desk]');
    if (!root) return;
    var clock = root.querySelector('[data-desk-clock]');
    function tickClock() {
      if (!clock) return;
      var d = new Date();
      function p(n) { return (n < 10 ? '0' : '') + n; }
      clock.textContent = p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds()) + ' UTC';
    }
    tickClock();
    setInterval(tickClock, 1000);
    if (reduced) return;

    var body = root.querySelector('[data-desk-rows]');
    var cmd = root.querySelector('[data-desk-cmd]');
    var stages = root.querySelectorAll('[data-desk-stages] span');
    var STEPS = ['Qualify', 'Map', 'Negotiate', 'Execute'];
    var POOL = [
      ['Compute', 'GB300 NVL72 · rack-scale allocation', 'US'],
      ['Power', 'Interconnection position · behind-the-meter', 'NA'],
      ['Capacity', 'Liquid-cooled colocation · high density', 'EMEA'],
      ['Contract', 'Reserved GPUaaS · multi-year term', 'US'],
      ['Offtake', 'Anchor tenant · KYC on ultimate offtaker', 'APAC'],
      ['Compute', 'HGX B300 · cancelled-order reallocation', 'ISL'],
      ['Develop', 'Powered shell · build-to-suit', 'CAN'],
      ['Licensing', 'Microsoft SPLA · data center estate', 'EMEA'],
      ['Contract', 'Committed-spend AI cloud renewal', 'NA'],
      ['Capacity', 'Wholesale colocation · sovereign program', 'APAC'],
      ['Compute', 'B200 cluster · fabric and spares terms', 'LATAM'],
      ['Power', 'PPA structure · energisation timeline', 'EMEA'],
      ['Cooling', 'Two-phase rear-door retrofit · live racks', 'US'],
      ['Offtake', 'Neocloud capacity · qualified demand', 'NA']
    ];
    var CMDS = [
      'desk.match <b>--stack=full</b> --region=global',
      'desk.qualify <b>--counterparty</b> --kyc=ultimate',
      'desk.benchmark <b>--terms</b> --against=market',
      'desk.map <b>--layer=power,capacity,compute</b>',
      'desk.route <b>--direct</b> --no-intermediaries'
    ];
    var next = 6, cmdI = 1, stageI = 0; // first six pool rows are already in the markup
    // stages advance on their own clock
    function stepStage() {
      stages.forEach(function (s, i) {
        s.classList.remove('on', 'done');
        if (i < stageI) s.classList.add('done');
        if (i === stageI) { void s.offsetWidth; s.classList.add('on'); }
      });
      stageI = (stageI + 1) % stages.length;
    }
    function typeCmd() {
      if (!cmd) return;
      var html = CMDS[cmdI++ % CMDS.length];
      var plain = html.replace(/<[^>]+>/g, '');
      var n = 0;
      (function t() {
        n++;
        // rebuild with markup once fully typed; type plain text before that
        cmd.innerHTML = '<span aria-hidden="true">›</span> ' + (n >= plain.length ? html : plain.slice(0, n).replace(/</g, '&lt;')) + '<span class="desk-caret" aria-hidden="true"></span>';
        if (n < plain.length) setTimeout(t, 26 + Math.random() * 40);
      })();
    }
    function pushRow() {
      var item = POOL[next++ % POOL.length];
      var step = STEPS[Math.floor(Math.random() * STEPS.length)];
      var row = document.createElement('div');
      row.className = 'desk-row is-new';
      row.innerHTML = '<span class="l"></span><span class="r"></span><span class="g"></span><span class="s"></span>';
      row.children[0].textContent = item[0];
      row.children[1].textContent = item[1];
      row.children[2].textContent = item[2];
      row.children[3].textContent = step;
      row.children[3].setAttribute('data-s', step);
      body.insertBefore(row, body.firstChild);
      while (body.children.length > 7) body.removeChild(body.lastChild);
      // advance one existing row a step, so the board visibly progresses
      var rows = body.querySelectorAll('.desk-row');
      var pick = rows[1 + Math.floor(Math.random() * Math.max(1, rows.length - 1))];
      if (pick) {
        var s = pick.querySelector('.s');
        var at = STEPS.indexOf(s.getAttribute('data-s'));
        if (at > -1 && at < STEPS.length - 1) { s.textContent = STEPS[at + 1]; s.setAttribute('data-s', STEPS[at + 1]); }
      }
      setTimeout(function () { row.classList.remove('is-new'); }, 1400);
    }
    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(root);
    }
    stepStage();
    typeCmd();
    setInterval(function () { if (visible && !document.hidden) stepStage(); }, 2600);
    setInterval(function () { if (visible && !document.hidden) pushRow(); }, 2900);
    setInterval(function () { if (visible && !document.hidden) typeCmd(); }, 9000);
  })();

  /* ---------- lead alerts: tag inquiry email subjects by urgency ----------
     Every Web3Forms inquiry arrives by email. The subject is prefixed so an
     inbox rule or phone notification can fire on "[HOT" alone:
       [HOT]    this week / urgent / soonest live date / frontier-hyperscale scale
       [WARM]   this month / next quarter
       [LEAD]   everything else
       [SCREEN] broker or reseller — check the end user before calling */
  (function leadAlerts() {
    document.addEventListener('submit', function (e) {
      var f = e.target;
      if (!f || !f.action || f.action.indexOf('web3forms') === -1) return;
      var subj = f.querySelector('input[name="subject"]');
      if (!subj || subj.dataset.tagged) return;
      function v(n) { var el = f.querySelector('[name="' + n + '"]'); return el ? String(el.value || '').trim() : ''; }
      var when = [v('decision_window'), v('live_date'), v('timing')].join(' ');
      var scale = v('scale') + ' ' + v('qty');
      var tier = 'LEAD';
      if (/this month|next quarter|this quarter/i.test(when)) tier = 'WARM';
      if (/this week|urgent|soonest|immediate|asap/i.test(when) || /frontier|hyperscale|1,000\+ hosts/i.test(scale)) tier = 'HOT';
      if (/broker|reseller/i.test(v('position'))) tier = 'SCREEN';
      var what = v('what_they_need') || v('platform') || v('product') || '';
      var parts = [subj.value, what, location.pathname].filter(Boolean);
      subj.value = '[' + tier + '] ' + parts.join(' · ');
      subj.dataset.tagged = '1';
      var hid = document.createElement('input');
      hid.type = 'hidden'; hid.name = 'lead_priority'; hid.value = tier;
      f.appendChild(hid);
    }, true);
  })();

  /* ---------- lazy-load Google Preferred Sources button ---------- */
  (function preferredSource() {
    var host = document.querySelector('[google-add-preferred-source-btn]');
    if (!host || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.disconnect();
        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://news.google.com/swg/js/v1/publisher.js';
        document.head.appendChild(s);
      });
    }, { rootMargin: '200px' });
    io.observe(host);
  })();
})();
