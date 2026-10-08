// Lead-gen intake + qualification engine
(function () {
  'use strict';

  var CFG = window.TCN_CONFIG || {};
  var LEADS_KEY = 'tcn_leads_v1';

  // ---------------------------------------------------------------
  // SCORING MODEL — 100 points.
  // Weights reflect what makes a buyer real: who they are, whether
  // they've cleared NVIDIA procurement before, size, capital, authority.
  // Edit any `p` value to re-weight. Tier cutoffs are at the bottom.
  // ---------------------------------------------------------------
  var MODEL = {
    orgType: {
      label: 'Organization type', max: 30, weightNote: 'Who you are',
      opts: [
        { v: 'hyperscaler', t: 'Hyperscaler / CSP',        s: 'Tier-1 cloud',        p: 30 },
        { v: 'neocloud',    t: 'Neocloud / GPU cloud',     s: 'AI infra operator',   p: 27 },
        { v: 'enterprise',  t: 'Enterprise',               s: 'Fortune 1000',        p: 25 },
        { v: 'sled',        t: 'Government / SLED',        s: 'Public sector',       p: 24 },
        { v: 'research',    t: 'Research / national lab',  s: 'Academic / HPC',      p: 20 },
        { v: 'ailab',       t: 'Funded AI lab or startup', s: 'Series B+',           p: 14 },
        { v: 'integrator',  t: 'OEM / systems integrator', s: 'Building for a client', p: 12 },
        { v: 'broker',      t: 'Broker / reseller',        s: 'Not the end user',    p: 0, dq: true },
      ],
    },
    nvidiaHistory: {
      label: 'Prior NVIDIA procurement', max: 25, weightNote: 'Compliance track record',
      opts: [
        { v: 'direct_scale', t: 'Yes — direct from NVIDIA or OEM, at scale', s: '500+ units cleared', p: 25 },
        { v: 'direct',       t: 'Yes — direct from NVIDIA or an OEM',        s: 'Approved account',   p: 22 },
        { v: 'partner',      t: 'Yes — through a channel partner',           s: 'Reseller / VAR',     p: 16 },
        { v: 'small',        t: 'Yes — but small volume only',               s: 'Under 64 units',     p: 9 },
        { v: 'none',         t: 'No — this would be our first',              s: 'New to allocation',  p: 3 },
      ],
    },
    quantity: {
      label: 'Units required', max: 20, weightNote: 'Deal size',
      opts: [
        { v: '4096+',   t: '4,096+',      s: 'Multi-cluster', p: 20 },
        { v: '1025',    t: '1,025–4,096', s: 'Cluster scale', p: 17 },
        { v: '257',     t: '257–1,024',   s: 'Multi-rack',    p: 14 },
        { v: '64',      t: '64–256',      s: 'Rack scale',    p: 10 },
        { v: 'under64', t: 'Under 64',    s: 'Below minimum', p: 2 },
      ],
    },
    budget: {
      label: 'Capital allocated', max: 15, weightNote: 'Funding',
      opts: [
        { v: '100m+',  t: '$100M+',      s: 'Committed',    p: 15 },
        { v: '25m',    t: '$25M–$100M',  s: 'Committed',    p: 12 },
        { v: '5m',     t: '$5M–$25M',    s: 'Approved',     p: 9 },
        { v: 'under5', t: 'Under $5M',   s: 'Approved',     p: 5 },
        { v: 'tbd',    t: 'Not yet allocated', s: 'Pre-budget', p: 1 },
      ],
    },
    authority: {
      label: 'Your role in the decision', max: 10, weightNote: 'Authority',
      opts: [
        { v: 'signer',      t: 'I sign the purchase order',  s: 'Final authority', p: 10 },
        { v: 'budget',      t: 'I own the budget',           s: 'Budget holder',   p: 9 },
        { v: 'recommender', t: 'I recommend, someone signs', s: 'Influencer',      p: 6 },
        { v: 'research',    t: 'Gathering information',      s: 'Early stage',     p: 2 },
      ],
    },
  };

  var GPUS = ['Vera Rubin', 'B300', 'GB300', 'B200', 'H200', 'H100', 'GPUaaS cluster'];

  var TIERS = {
    priority:  { min: 72, name: 'Priority',  cls: 't1' },
    qualified: { min: 45, name: 'Qualified', cls: 't2' },
    waitlist:  { min: 0,  name: 'Waitlist',  cls: 't3' },
  };

  var FREE_MAIL = ['gmail.com','yahoo.com','hotmail.com','outlook.com','aol.com','icloud.com','proton.me','protonmail.com','live.com','msn.com'];

  function scoreLead(a) {
    var total = 0, breakdown = {}, dq = false;
    Object.keys(MODEL).forEach(function (k) {
      var found = MODEL[k].opts.filter(function (o) { return o.v === a[k]; })[0];
      var p = found ? found.p : 0;
      breakdown[k] = { label: MODEL[k].label, points: p, max: MODEL[k].max, choice: found ? found.t : '—' };
      total += p;
      if (found && found.dq) dq = true;
    });
    var domain = (a.email || '').split('@')[1] || '';
    var freeMail = FREE_MAIL.indexOf(domain.toLowerCase()) !== -1;
    var tierKey = dq ? 'waitlist'
      : total >= TIERS.priority.min ? 'priority'
      : total >= TIERS.qualified.min ? 'qualified' : 'waitlist';
    return {
      score: total, tier: tierKey, tierName: TIERS[tierKey].name, tierCls: TIERS[tierKey].cls,
      breakdown: breakdown, dq: dq, freeMail: freeMail, domain: domain,
    };
  }

  // ---------- local store (feeds the admin console Leads tab) ----------
  function readLeads() {
    try { return JSON.parse(localStorage.getItem(LEADS_KEY)) || []; } catch (e) { return []; }
  }
  function saveLead(rec) {
    try {
      var list = readLeads();
      rec.id = 'ld_' + Math.random().toString(36).slice(2, 9);
      rec.created = Date.now();
      list.unshift(rec);
      localStorage.setItem(LEADS_KEY, JSON.stringify(list.slice(0, 500)));
      return rec;
    } catch (e) { return rec; }
  }

  // ---------- markup ----------
  function optSet(key, def, cls) {
    var m = MODEL[key];
    return '<div class="lg-q" data-q="' + key + '">' +
      '<label>' + m.label + ' <span class="req">*</span></label>' +
      '<div class="lg-opts ' + (cls || 'two') + '">' +
      m.opts.map(function (o) {
        return '<label class="lg-opt"><input type="radio" name="' + key + '" value="' + o.v + '" />' +
          '<span class="mk"></span><span>' + o.t + '<span class="sub">' + o.s + '</span></span></label>';
      }).join('') +
      '</div></div>';
  }

  function formHtml(opts) {
    var eyebrow = opts.eyebrow || 'Allocation request';
    var title = opts.title || 'Request access to allocation';
    var sub = opts.sub || 'Eight questions. We score it on submit and tell you where you stand — no waiting on a callback to find out.';
    return '' +
    '<div class="lg-intake" data-lg-root>' +
      '<form class="lg-form" novalidate>' +
        '<div class="lg-intake-head">' +
          '<div>' +
            '<span class="page-eyebrow" style="margin-bottom:10px"><span class="dot"></span>' + eyebrow + '</span>' +
            '<h2 class="lg-intake-title">' + title + '</h2>' +
          '</div>' +
          '<div class="lg-step-dots"><i class="on"></i><i></i><i></i></div>' +
        '</div>' +
        '<p class="lg-intake-sub">' + sub + '</p>' +

        '<div class="lg-row">' +
          '<div class="lg-q"><label>Company <span class="req">*</span></label><input type="text" name="company" placeholder="Legal entity name" autocomplete="organization" /></div>' +
          '<div class="lg-q"><label>Work email <span class="req">*</span></label><input type="email" name="email" placeholder="you@company.com" autocomplete="email" /></div>' +
        '</div>' +
        '<div class="lg-row">' +
          '<div class="lg-q"><label>Your name <span class="req">*</span></label><input type="text" name="name" placeholder="Full name" autocomplete="name" /></div>' +
          '<div class="lg-q"><label>Title</label><input type="text" name="title" placeholder="e.g. VP Infrastructure" autocomplete="organization-title" /></div>' +
        '</div>' +

        optSet('orgType') +
        optSet('nvidiaHistory') +
        optSet('quantity', null, 'chips') +
        optSet('budget', null, 'chips') +
        optSet('authority') +

        '<div class="lg-q" data-q="gpus">' +
          '<label>What are you after</label>' +
          '<div class="lg-opts chips">' +
            GPUS.map(function (g) {
              return '<label class="lg-opt chip"><input type="checkbox" name="gpus" value="' + g + '" />' +
                '<span class="mk"></span><span>' + g + '</span></label>';
            }).join('') +
          '</div>' +
        '</div>' +

        '<div class="lg-q"><label>Deployment context</label><textarea name="notes" placeholder="Power and datacenter readiness, target date, networking, anything that helps us move faster."></textarea></div>' +

        '<div class="lg-actions">' +
          '<button type="submit" class="btn btn-primary btn-lg">Submit for qualification</button>' +
          '<span class="lg-err" data-lg-err aria-live="polite"></span>' +
        '</div>' +
        '<p class="lg-note">Sent direct to the allocation desk. We do not share, resell, or list your inquiry. End users only — brokers are routed to the waitlist.</p>' +
      '</form>' +

      '<div class="lg-result" data-lg-result></div>' +
    '</div>';
  }

  var COPY = {
    priority: {
      h: 'Cleared for the <em>allocation desk.</em>',
      s: 'You scored in our top band. That means a named rep, current allocation windows, and pricing on real inventory — not a general inbox.',
      next: [
        'A member of the desk contacts you within one business day.',
        'You receive current availability and lead times for your SKUs.',
        'We build an itemized BOM and quote against live stock.',
      ],
    },
    qualified: {
      h: 'Qualified for <em>allocation review.</em>',
      s: 'You clear our threshold. Your request goes into this week\u2019s review cycle — we match you against inbound stock as it lands.',
      next: [
        'We review your request in the next allocation cycle.',
        'You get availability once we can serve your quantity.',
        'Firming up budget or timeline moves you into the priority band.',
      ],
    },
    waitlist: {
      h: 'Added to the <em>waitlist.</em>',
      s: 'We can\u2019t serve this one from current allocation. You stay on the list and we reach out when supply or terms change.',
      next: [
        'You are on the list — no further action needed.',
        'Our minimum is 64 units; end users only, no brokers.',
        'Resubmit once budget is allocated or quantity increases.',
      ],
    },
  };

  function resultHtml(r, a) {
    var c = COPY[r.tier];
    var rows = Object.keys(r.breakdown).map(function (k) {
      var b = r.breakdown[k];
      return '<div><span class="n">' + b.points + '/' + b.max + '</span><span>' + b.label + ' — ' + b.choice + '</span></div>';
    }).join('');
    return '' +
      '<span class="lg-tier-badge ' + r.tierCls + '"><i></i>' + r.tierName + (r.dq ? ' — end-user verification required' : '') + '</span>' +
      '<h3>' + c.h + '</h3>' +
      '<p class="rs">' + c.s + '</p>' +
      '<div class="lg-tierbar"><i data-bar></i></div>' +
      '<div class="lg-score">Qualification score <b>' + r.score + '</b> / 100 &nbsp;·&nbsp; ' + r.tierName + ' band</div>' +
      '<div class="lg-next">' + c.next.map(function (t, i) {
        return '<div><span class="n">0' + (i + 1) + '</span><span>' + t + '</span></div>';
      }).join('') + '</div>' +
      '<div class="lg-next" style="margin-top:12px">' + rows + '</div>' +
      (r.tier === 'priority'
        ? '<div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap"><a class="btn btn-primary" href="inventory.html">View live inventory</a><a class="btn btn-ghost" href="mailto:' + ((CFG.contact && CFG.contact.email) || 'sales@thechiefnegotiators.com') + '?subject=Priority%20allocation%20—%20' + encodeURIComponent(a.company || '') + '">Email the desk direct</a></div>'
        : '<div style="margin-top:24px"><a class="btn btn-ghost" href="availability.html">See current availability &rarr;</a></div>');
  }

  // ---------- wiring ----------
  function mount(el) {
    el.innerHTML = formHtml({
      eyebrow: el.getAttribute('data-eyebrow') || undefined,
      title: el.getAttribute('data-title') || undefined,
      sub: el.getAttribute('data-sub') || undefined,
    });
    var root = el.querySelector('[data-lg-root]');
    var form = root.querySelector('.lg-form');
    var errEl = root.querySelector('[data-lg-err]');
    var resEl = root.querySelector('[data-lg-result]');
    var dots = root.querySelectorAll('.lg-step-dots i');

    // option selection visuals
    root.addEventListener('change', function (e) {
      var inp = e.target;
      if (inp.type === 'radio') {
        var group = root.querySelectorAll('input[name="' + inp.name + '"]');
        Array.prototype.forEach.call(group, function (g) {
          g.closest('.lg-opt').classList.toggle('sel', g.checked);
        });
        var wrap = inp.closest('.lg-opts'); if (wrap) wrap.classList.remove('bad');
        var q = inp.closest('.lg-q'); if (q) q.classList.remove('bad');
      } else if (inp.type === 'checkbox') {
        inp.closest('.lg-opt').classList.toggle('sel', inp.checked);
      }
      updateDots();
    });
    root.addEventListener('input', function (e) {
      if (e.target.classList) e.target.classList.remove('bad');
      var q = e.target.closest && e.target.closest('.lg-q');
      if (q) q.classList.remove('bad');
      updateDots();
    });

    function vals() {
      var fd = new FormData(form);
      var o = {};
      ['company','email','name','title','notes','orgType','nvidiaHistory','quantity','budget','authority']
        .forEach(function (k) { o[k] = (fd.get(k) || '').toString().trim(); });
      o.gpus = fd.getAll('gpus');
      return o;
    }
    function filled(a) {
      var need = ['company','email','name','orgType','nvidiaHistory','quantity','budget','authority'];
      return need.filter(function (k) { return !a[k]; }).length === 0 ? need.length : need.filter(function (k) { return !!a[k]; }).length;
    }
    function updateDots() {
      var a = vals();
      var n = ['company','email','name','orgType','nvidiaHistory','quantity','budget','authority']
        .filter(function (k) { return !!a[k]; }).length;
      var stage = n >= 8 ? 3 : n >= 4 ? 2 : 1;
      Array.prototype.forEach.call(dots, function (d, i) { d.classList.toggle('on', i < stage); });
    }

    function scrollToFirstBad() {
      var first = form.querySelector('.lg-q.bad');
      if (!first) return;
      var y = first.getBoundingClientRect().top + window.pageYOffset - 110;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      var focusable = first.querySelector('input,textarea');
      if (focusable && focusable.type !== 'radio') setTimeout(function () { focusable.focus({ preventScroll: true }); }, 380);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var a = vals();
      var missing = [];
      [['company','Company'],['email','Work email'],['name','Your name'],
       ['orgType','Organization type'],['nvidiaHistory','Prior NVIDIA procurement'],
       ['quantity','Units required'],['budget','Capital allocated'],['authority','Your role']]
        .forEach(function (pair) { if (!a[pair[0]]) missing.push(pair); });

      if (missing.length) {
        missing.forEach(function (pair) {
          var f = form.querySelector('[name="' + pair[0] + '"]');
          if (!f) return;
          var q = f.closest('.lg-q');
          if (q) q.classList.add('bad');
          if (f.type === 'radio') { var w = f.closest('.lg-opts'); if (w) w.classList.add('bad'); }
          else f.classList.add('bad');
        });
        errEl.textContent = missing.length === 1
          ? 'Still need: ' + missing[0][1]
          : missing.length + ' answers still needed';
        scrollToFirstBad();
        return;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email)) {
        var em = form.querySelector('[name=email]');
        em.classList.add('bad');
        var eq = em.closest('.lg-q'); if (eq) eq.classList.add('bad');
        errEl.textContent = 'Use a valid work email';
        scrollToFirstBad();
        return;
      }
      errEl.textContent = '';

      var r = scoreLead(a);
      var rec = {
        company: a.company, email: a.email, name: a.name, title: a.title,
        orgType: a.orgType, nvidiaHistory: a.nvidiaHistory, quantity: a.quantity,
        budget: a.budget, authority: a.authority, gpus: a.gpus, notes: a.notes,
        score: r.score, tier: r.tier, dq: r.dq, freeMail: r.freeMail, domain: r.domain,
        source: (location.pathname.split('/').pop() || 'index.html'),
      };
      saveLead(rec);

      // Email it out via Formspree (uses the existing contact endpoint)
      var endpoint = (CFG.formspree && (CFG.formspree.lead || CFG.formspree.contact)) || '';
      if (endpoint) {
        var payload = {
          _subject: '[' + r.tierName.toUpperCase() + ' · ' + r.score + '/100] ' + a.company + ' — allocation request',
          Tier: r.tierName, Score: r.score + '/100',
          Company: a.company, Contact: a.name + (a.title ? ' (' + a.title + ')' : ''),
          Email: a.email, Domain: r.domain,
          OrganizationType: r.breakdown.orgType.choice,
          PriorNvidiaProcurement: r.breakdown.nvidiaHistory.choice,
          UnitsRequired: r.breakdown.quantity.choice,
          CapitalAllocated: r.breakdown.budget.choice,
          DecisionAuthority: r.breakdown.authority.choice,
          Interest: (a.gpus || []).join(', '),
          Notes: a.notes || '—',
          Flags: [r.dq ? 'BROKER/RESELLER' : '', r.freeMail ? 'FREE EMAIL DOMAIN' : ''].filter(Boolean).join(' · ') || 'none',
          SubmittedFrom: rec.source,
        };
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        }).catch(function () {});
      }

      // reveal
      form.style.display = 'none';
      resEl.innerHTML = resultHtml(r, a);
      resEl.classList.add('show');
      setTimeout(function () {
        var bar = resEl.querySelector('[data-bar]');
        if (bar) bar.style.width = Math.max(6, r.score) + '%';
      }, 60);
      var top = root.getBoundingClientRect().top + window.pageYOffset - 90;
      window.scrollTo({ top: top, behavior: 'smooth' });
    });

    updateDots();
  }

  document.addEventListener('DOMContentLoaded', function () {
    Array.prototype.forEach.call(document.querySelectorAll('[data-intake]'), mount);
  });

  window.TCNLeads = { MODEL: MODEL, TIERS: TIERS, score: scoreLead, all: readLeads, KEY: LEADS_KEY };
})();
