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
    window.addEventListener('scroll', function () {
      if (active) active.rect = active.el.getBoundingClientRect();
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
