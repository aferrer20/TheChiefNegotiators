// Prospect Desk — call-first prospecting copilot
// The only metric this desk optimises: 20-minute calls booked with the closer.
//
// What changed from v1
//   * Runs on your own site: calls the AI through a Netlify function
//     (config.exchange.deskEndpoint), falls back to window.claude.complete.
//   * Inventory-aware: reads live lots from the Exchange and uses them as
//     specific, factual reasons to talk, with deep links to each lot.
//   * Five-touch, multi-channel cadence (LinkedIn, phone, LinkedIn proof,
//     breakup) instead of three LinkedIn messages and stop.
//   * Every post-reply draft carries a call ask: booking link or two times.
//   * Call likelihood score, power-hour queue, funnel metrics, call brief
//     for the closer, one-click objection plays.
// Data stays in the same localStorage key as v1, so existing threads carry over.
(function () {
  var KEY = 'ssp_desk_v1', SKEY = 'ssp_desk_settings_v1';
  var CFG = window.TCN_CONFIG || {};
  var XC = CFG.exchange || {};
  var DEFAULT_LINK = XC.bookingLink || 'https://bookings.cloud.microsoft/bookwithme/user/d68d0b6c190649deb8628fa8f622671e%40thechiefnegotiators.com?anonymous&ismsaljsauthenabled=true';
  var DEFAULT_BOOK = [
    'Vera Rubin GPUaaS: 3,600 GPUs, live end of Q1 2027, $8.00/GPU/hr, 30% down, 5-year term.',
    'B300 GPUaaS: 128 nodes (1,024 GPUs), live Q4 2026, $4.45/GPU/hr, 25% down.',
    'B300 GPUaaS: 62 nodes (496 GPUs), live Q1 2027, $4.30/GPU/hr, 5-year term, 20% down.',
    'GB300 GPUaaS: 2,304 GPUs, live Q1 2027, $4.40/GPU/hr, 5-year term, 20% down.',
    'Colocation: suppliers support 1 MW to 1 GW across the US, EU and Canada. Pricing ($/kW/mo) is set by the operator; never quote it.',
    'GPU purchase (B300, GB300, B200, H200, H100): allocation access, 64-unit minimum. No hardware pricing on LinkedIn.'
  ].join('\n');
  var SIDES = { buyer: 'Buyer, enterprise or AI company', neocloud: 'Buyer, neocloud', supplier: 'Seller, GPU holder', operator: 'Operator, colo sell-side' };
  var STAGES = ['new', 'contacted', 'engaged', 'qualifying', 'booking', 'booked', 'nurture', 'disqualified'];
  var INTERESTS = ['GPU hardware', 'GPUaaS', 'Vera Rubin', 'Colocation', 'Selling capacity'];
  var MOVES = { qualify: 'Qualify, then ask', book: 'Ask for the call now', handle_objection: 'Handle it, then ask', nurture: 'Nurture, set a date', back_off: 'Back off', disqualify: 'Disqualify' };
  var QF = [['size', 'GPUs / MW'], ['market', 'Market'], ['timeline', 'Timeline'], ['density', 'Model / type'], ['budget', 'Budget']];

  // Five touches. Each one has a different job, and three of them ask for the call.
  var CADENCE = [
    { n: 1, day: 3,  ch: 'LinkedIn', key: 'value',   label: 'Day 3, value bump',    job: 'New reason to talk: a specific lot or market fact. Soft call ask.' },
    { n: 2, day: 7,  ch: 'Phone',    key: 'call',    label: 'Day 7, phone touch',   job: 'Call if you have a number; otherwise a 20-second LinkedIn voice note. Leave a short voicemail.' },
    { n: 3, day: 10, ch: 'LinkedIn', key: 'proof',   label: 'Day 10, proof point',  job: 'One line of proof (how we work, what buyers like them get). Two-time close.' },
    { n: 4, day: 16, ch: 'LinkedIn', key: 'breakup', label: 'Day 16, close the loop', job: 'Polite breakup. Breakups get the highest reply rate of the sequence.' },
  ];

  var state = { sel: null, filter: 'all', q: '', mode: 'them', busy: false, err: null, lots: [], brief: null };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(list) { localStorage.setItem(KEY, JSON.stringify(list)); }
  function settings() {
    var s = {}; try { s = JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (e) {}
    var exUrl = s.exchangeUrl || (location.origin && /^http/.test(location.origin) ? location.origin + '/exchange.html' : 'https://thechiefnegotiators.com/exchange.html');
    return {
      rep: s.rep || 'Camila', closer: s.closer || 'Amanda Ferrer', closerRole: s.closerRole || 'founder',
      brand: s.brand || 'The Chief Negotiators', link: s.link || DEFAULT_LINK, book: s.book || DEFAULT_BOOK, rules: s.rules || '',
      exchangeUrl: exUrl, deskKey: s.deskKey || '', tz: s.tz || 'ET',
    };
  }
  function get(id) { return load().filter(function (p) { return p.id === id; })[0]; }
  function put(p) { var l = load(); var i = l.findIndex(function (x) { return x.id === p.id; }); p.updated = Date.now(); if (i < 0) l.unshift(p); else l[i] = p; save(l); }
  function days(ts) { return Math.floor((Date.now() - ts) / 86400000); }
  function ago(ts) { var d = days(ts); if (d <= 0) { var h = Math.floor((Date.now() - ts) / 3600000); return h <= 0 ? 'just now' : h + 'h ago'; } return d + 'd ago'; }
  function toast(m) { if (window.TCN && window.TCN.toast) window.TCN.toast(m); }
  function first(n) { return String(n || '').split(' ')[0]; }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(fb);
    fb(); return Promise.resolve();
    function fb() { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) {} t.remove(); }
  }

  // Two concrete slots in the next business days: the "two-time close".
  function slots() {
    var out = [], d = new Date(), hrs = [10, 14];
    while (out.length < 2) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      out.push(d.toLocaleDateString('en-US', { weekday: 'long' }) + ' at ' + (hrs[out.length] > 12 ? hrs[out.length] - 12 + 'pm' : hrs[out.length] + 'am') + ' ' + settings().tz);
    }
    return out;
  }

  // Tokens: [booking link] and [lot TCN-B300-0403]
  function withLinks(t) {
    var s = settings();
    return String(t || '').replace(/\[booking link\]/gi, s.link).replace(/\[lot ([A-Z0-9-]+)\]/gi, function (_, ref) { return s.exchangeUrl + '#lot=' + ref.toUpperCase(); });
  }
  function showText(t) { return esc(t).replace(/\[booking link\]/gi, '<span class="lk">booking link</span>').replace(/\[lot ([A-Z0-9-]+)\]/gi, '<span class="lk">lot $1</span>'); }
  function hasCallAsk(t) { return /\[booking link\]|bookings\.cloud|\b(call|chat|speak|talk|20 minutes|15 minutes|calendar)\b.*\?|\b(monday|tuesday|wednesday|thursday|friday)\b.*\b(or)\b/i.test(t || ''); }

  // ---------- Live lots from the Exchange ----------
  function lotLine(l) {
    return l.ref + ': ' + l.model + (l.config ? ' ' + l.config : '') + ', ' + l.gpu_count + ' GPUs, ' + (l.kind === 'gpuaas' ? 'GPUaaS' : 'hardware') + ', ' + (l.region || '') + ', available ' + (l.available || 'TBC') + (l.status === 'reserved' ? ' (under offer, backup positions open)' : '');
  }
  async function loadLots() {
    if (!window.TCNX) return;
    try {
      var all = [];
      try { all = await window.TCNX.admin.listings(); } catch (e1) { all = []; }
      if (!all.length) all = await window.TCNX.floor();
      state.lots = all.filter(function (l) { return l.status === 'live' || l.status === 'reserved'; });
    } catch (e) { state.lots = []; }
  }
  function lotsFor(p) {
    var want = ((p.interest || []).join(' ') + ' ' + (p.notes || '')).toLowerCase();
    var scored = state.lots.map(function (l) {
      var s = 0;
      if (want.indexOf(String(l.model).toLowerCase()) > -1) s += 3;
      if (/gpuaas|cloud/.test(want) && l.kind === 'gpuaas') s += 2;
      if (/hardware|purchase|buy/.test(want) && l.kind === 'hardware') s += 2;
      if (p.side === 'neocloud' && l.kind === 'gpuaas') s += 1;
      if (l.featured) s += 1;
      return { l: l, s: s };
    }).sort(function (a, b) { return b.s - a.s; });
    return scored.slice(0, 4).map(function (x) { return x.l; });
  }

  // ---------- Cadence ----------
  function cadence(p) {
    var th = p.thread || [];
    if (!th.length) return { kind: 'opener' };
    var last = th[th.length - 1];
    if (last.role === 'them') return { kind: 'reply', since: days(last.ts) };
    var lastThem = -1; th.forEach(function (m, i) { if (m.role === 'them') lastThem = i; });
    var outs = th.slice(lastThem + 1);
    var n = outs.length;
    if (lastThem > -1) {
      // They replied before and went quiet: chase the call, 2 bumps, then nurture.
      if (n >= 3) return { kind: 'stop', since: days(outs[n - 1].ts) };
      var dueR = (n === 1 ? 2 : 6) - days(outs[0].ts);
      return { kind: 'waiting', step: { n: n, label: n === 1 ? 'Day 2, nudge after reply' : 'Day 6, last nudge', ch: 'LinkedIn', key: 'chase', job: 'They engaged then went quiet. Re-ask for the call with two times.' }, dueIn: dueR };
    }
    if (n > CADENCE.length) return { kind: 'stop', since: days(outs[n - 1].ts) };
    var step = CADENCE[n - 1];
    return { kind: 'waiting', step: step, dueIn: step.day - days(outs[0].ts) };
  }
  function isDue(p) { var c = cadence(p); return ['booked', 'disqualified', 'nurture'].indexOf(p.stage) < 0 && (c.kind === 'reply' || (c.kind === 'waiting' && c.dueIn <= 0) || (c.kind === 'opener' && p.stage === 'new')); }
  function heat(p) {
    if (p.stage === 'booked') return 100;
    if (p.analysis && typeof p.analysis.call_likelihood === 'number') return p.analysis.call_likelihood;
    return { new: 10, contacted: 15, engaged: 45, qualifying: 55, booking: 70, nurture: 12, disqualified: 0 }[p.stage] || 10;
  }

  // ---------- Playbook templates (offline, no AI needed) ----------
  function templates(p) {
    var s = settings(), f = p.first || '{First}', closer = first(s.closer), sl = slots();
    var lot = lotsFor(p)[0];
    var lotHook = lot ? 'We just had ' + lot.gpu_count.toLocaleString('en-US') + ' ' + lot.model + (lot.kind === 'gpuaas' ? ' GPUaaS' : '') + ' (' + (lot.available || 'near-term') + ') come onto the exchange: [lot ' + lot.ref + ']. ' : '';
    var two = sl[0] + ' or ' + sl[1];
    var T = {
      buyer: {
        opener: 'Hi ' + f + ', thanks for connecting. I\'m with ' + s.brand + '. We run a members-only exchange for GPU allocation and GPUaaS capacity, with every seller verified. Are you planning to add compute in the next 12 months?',
        value: 'Hi ' + f + ', ' + (lotHook || 'Q1 \'27 B300 and GB300 capacity is committing now. ') + 'Worth 20 minutes with ' + closer + ' to see if it fits what you\'re building?',
        call: 'Voicemail: "Hi ' + f + ', ' + s.rep + ' from ' + s.brand + '. We place GPU allocation and GPUaaS capacity for teams scaling compute. I sent you a note on LinkedIn; worth a quick call with ' + closer + '? I\'ll send times there."',
        proof: 'Hi ' + f + ', one thing buyers tell us they value: they see verified allocation, with terms, before it reaches the open market, and pay nothing for the access. ' + closer + ' has ' + two + ' open. Either work?',
        breakup: 'Hi ' + f + ', I\'ll stop here. If compute comes onto the roadmap, the exchange is at ' + s.exchangeUrl + ' and ' + closer + '\'s calendar is here: [booking link]',
        book: 'Makes sense. The fastest next step is 20 minutes with ' + closer + ', our ' + s.closerRole + '. She\'ll come with the lots that fit. ' + two + '? Or grab any time here: [booking link]',
        chase: 'Hi ' + f + ', still worth a quick call? ' + closer + ' has ' + two + '. Or pick a time here: [booking link]',
      },
      supplier: {
        opener: 'Hi ' + f + ', thanks for connecting. I\'m with ' + s.brand + '. We run a members-only exchange where verified buyers source GPU allocation and GPUaaS capacity. Do you have capacity coming available in the next two quarters?',
        value: 'Hi ' + f + ', we have vetted buyers looking for B300 and GB300 capacity live by Q1 \'27, and your name never appears on the floor. Worth 20 minutes with ' + closer + ' to see if your capacity fits?',
        call: 'Voicemail: "Hi ' + f + ', ' + s.rep + ' from ' + s.brand + '. We have verified buyers for GPU capacity right now. Quick call with ' + closer + '? I\'ll send times on LinkedIn."',
        proof: 'Hi ' + f + ', sellers on the exchange only spend time with buyers whose budget and signing authority we have already checked. ' + closer + ' has ' + two + '. Either work?',
        breakup: 'Hi ' + f + ', I\'ll leave it here. When capacity frees up, you can list it at ' + s.exchangeUrl + '#sell, or grab time with ' + closer + ': [booking link]',
        book: 'Great. Next step is 20 minutes with ' + closer + ', our ' + s.closerRole + ', to walk through how listings and introductions work. ' + two + '? Or here: [booking link]',
        chase: 'Hi ' + f + ', still keen to put your capacity in front of our buyers? ' + closer + ' has ' + two + ', or [booking link]',
      },
      operator: {
        opener: 'Hi ' + f + ', thanks for connecting. I\'m with ' + s.brand + '. We bring vetted AI and enterprise tenants to colo operators (end users only, no brokers). Do you have capacity coming RFS this year or Q1 \'27?',
        value: 'Hi ' + f + ', we have active requirements across the US, EU and Canada from 1 MW up, mostly high-density AI. Worth 20 minutes with ' + closer + ' to see if your RFS dates line up?',
        call: 'Voicemail: "Hi ' + f + ', ' + s.rep + ' from ' + s.brand + '. We have tenants looking for AI-ready capacity. Quick call with ' + closer + '? Times on LinkedIn."',
        proof: 'Hi ' + f + ', operators work with us because tenants arrive with MW, density and timing already qualified. ' + closer + ' has ' + two + '. Either work?',
        breakup: 'Last note from me, ' + f + '. When new capacity is on the horizon, ' + closer + '\'s calendar is here: [booking link]',
        book: 'Great. Next step is 20 minutes with ' + closer + ', our ' + s.closerRole + ', on the requirements we\'re seeing. ' + two + '? Or here: [booking link]',
        chase: 'Hi ' + f + ', still worth a quick call? ' + closer + ' has ' + two + ', or [booking link]',
      },
    };
    T.neocloud = Object.assign({}, T.buyer, { opener: 'Hi ' + f + ', thanks for connecting. I\'m with ' + s.brand + '. We help neoclouds secure GPUaaS capacity and allocation on buyer-side terms, through a verified members-only exchange. Are you sourcing more capacity for 2026–27?' });
    return T[p.side] || T.buyer;
  }

  var OBJECTIONS = [
    ['info', 'Send me info'], ['price', 'What\'s the price?'], ['timing', 'Not right now'],
    ['have', 'We have a supplier'], ['who', 'Who are you?'], ['broker', 'Are you a broker?'],
  ];

  // ---------- Lint: guardrails plus the call-ask check ----------
  function lint(text, theirLast, p) {
    var w = [], s = String(text || ''), closer = first(settings().closer);
    if (/!/.test(s)) w.push('Exclamation mark');
    if (/\p{Extended_Pictographic}/u.test(s)) w.push('Emoji');
    if (/\b(we|i)\s+(own|hold|have)\s+(the\s+|a\s+|our\s+)?(\d|gpus?|capacity|inventory|cluster|nodes?|racks?|mw|site|data ?cent)/i.test(s) || /\bour\s+(gpus?|cluster|inventory|nodes?|data ?cent|site|capacity)\b/i.test(s)) w.push('Implies ownership; say "on the exchange" or "operators we work with"');
    if (/\$\s?\d/.test(s) && !/(price|pricing|rate|cost|\$|per hour|\/hr|how much|budget|quote|terms)/i.test(theirLast || '')) w.push('Price not asked for');
    if ((s.match(/\?/g) || []).length > 1) w.push('More than one question');
    if (/\b(fee|split|commission|referral)\b/i.test(s)) w.push('Fee talk; leave to ' + closer);
    if (/\b(urgent|act now|limited time|hurry|don'?t miss|asap|last chance)\b/i.test(s)) w.push('Hype language');
    if (s.split(/\s+/).filter(Boolean).length > 80) w.push('Long for LinkedIn');
    if (p && ['engaged', 'qualifying', 'booking'].indexOf(p.stage) > -1 && !hasCallAsk(s)) w.push('No call ask');
    return w;
  }

  // ---------- Engine ----------
  function systemPrompt(p) {
    var s = settings(), closer = first(s.closer);
    var lots = (p ? lotsFor(p) : state.lots).map(lotLine);
    return [
      'You are the prospecting copilot for ' + s.rep + ', a rep at ' + s.brand + '. You never message prospects yourself. You read the thread, decide the next move and write messages ' + s.rep + ' pastes into LinkedIn (or says on the phone).',
      '',
      'THE ONLY SCORE THAT COUNTS: a 20-minute call booked with ' + s.closer + ' (' + s.closerRole + '). Everything you write exists to get that call. Write the booking link literally as [booking link]. Offer two concrete times when closing: ' + slots().join(' or ') + '.',
      '',
      'WHO ' + s.brand.toUpperCase() + ' IS: an independent GPU procurement and capacity advisory that runs a members-only exchange (' + s.exchangeUrl + '). Sellers list GPU hardware allocation and GPUaaS capacity; buyers are vetted before they see terms; the desk introduces both sides under NCNDA and negotiates. We take no position; the client contracts directly with the counterparty. End users and direct holders only, no brokers. Buyers pay nothing.',
      'SIDES: buyer (enterprise / AI company), neocloud (buying GPUaaS or allocation), supplier (holds GPUs or GPUaaS capacity to sell; the call is about listing on the exchange), operator (colo; the call is about tenants we bring).',
      '',
      'CALL-FIRST PLAYBOOK:',
      '1. Earn the reply with something specific: a live lot, a market fact, their own news. Never a generic pitch.',
      '2. The moment there is any positive signal (a question, "tell me more", "maybe", sharing a requirement), ask for the call in the same message. Do not wait to finish qualifying. ' + closer + ' qualifies on the call.',
      '3. Close with two specific times plus the link ("' + slots()[0] + ' or ' + slots()[1] + '? Or any time here: [booking link]"). An either/or beats an open "would you like to chat".',
      '4. If they ask a question, answer it in one sentence, then ask for the call. Answer + ask, every time.',
      '5. Objections are buying signals. Acknowledge in a few words, give one fact, bridge to the call. "Send info" -> share ' + s.exchangeUrl + ' and offer the call as the faster path. "Price?" -> indicative rate from the offer book if listed, then "' + closer + ' can walk through deposit and term on a call". "Not now" -> ask when, propose a call then, record nurture_check. "Have a supplier" -> position as a benchmark and second source, ask for 20 minutes to compare.',
      '6. Use lots as reasons to talk, only when relevant to them: refer to a lot by its reference token, written literally like [lot TCN-B300-0403]. The token becomes a link. Never invent lots.',
      '7. If a call is booked or they agree, confirm warmly in one line and ask the single most useful prep question.',
      '',
      'CADENCE (no reply yet): Day 1 opener, Day 3 value bump with a lot or fact, Day 7 phone or voice note, Day 10 proof point with two-time close, Day 16 polite breakup. After they reply then go quiet: nudge Day 2 and Day 6 with two times, then nurture.',
      '',
      'HARD RULES:',
      '- Never name sellers, operators, partners or clients. Names are shared only under NCNDA, and ' + closer + ' handles that.',
      '- Never say ' + s.brand + ' owns, holds or operates GPUs, clusters, capacity or sites. Say "on the exchange", "sellers we work with", "we can secure access to".',
      '- Pricing: only when the prospect asks about price, rate, cost or terms. Then quote the offer book as indicative and subject to verification, and ask for the call. Never quote colo or hardware prices. Never mention fees or commission.',
      '- Tone: quiet confidence and real scarcity stated as fact ("the Q1 \'27 GB300 block is committing now"). No hype words, no exclamation marks, no emoji, no flattery.',
      '- One question per message. Under 70 words. Sound like a sharp human, not a template. Personalise one line when context allows.',
      '- Brokers without a mandate: thank them and disengage. Outside the US, Canada, EU and UK: politely decline.',
      s.rules ? '- ' + s.rules.split('\n').filter(Boolean).join('\n- ') : '',
      '',
      'OFFER BOOK (indicative, quote only when asked):',
      s.book,
      '',
      'LIVE LOTS ON THE EXCHANGE (most relevant first):',
      lots.length ? lots.join('\n') : '(none loaded; do not reference lots)',
      '',
      'Respond with ONLY a JSON object, no prose:',
      '{"stage":"new|contacted|engaged|qualifying|booking|booked|nurture|disqualified","side":"buyer|neocloud|supplier|operator","intent":"one short line on what they want or are signalling","call_likelihood":0-100,"next_move":{"action":"qualify|book|handle_objection|nurture|back_off|disqualify","why":"one or two sentences for the rep"},"flags":{"broker":false,"out_of_region":false,"price_asked":false,"agreed_to_call":false},"objection":{"detected":false,"type":"","read":"what is really behind it","handling":"one or two sentences"},"qualification":{"size":null,"market":null,"timeline":null,"density":null,"budget":null},"ask_next":"the most valuable question to ask on the call, or empty","lots_to_mention":["TCN-..."],"drafts":[{"label":"Recommended","text":"..."},{"label":"Two-time close","text":"..."},{"label":"Shorter","text":"..."}],"follow_up":"bump to send if they go quiet after this","nurture_check":"if timing is off, when to check back, else empty"}',
      'Every draft after a reply must contain a call ask. qualification: merge what is known across the whole thread; short strings or null. Drafts must obey every rule.'
    ].filter(function (x) { return x !== null; }).join('\n');
  }

  function userPrompt(p, latest, extra) {
    var s = settings();
    var lines = (p.thread || []).map(function (m) { return (m.role === 'us' ? s.rep.toUpperCase() : (p.first || 'PROSPECT').toUpperCase()) + ' (' + new Date(m.ts).toISOString().slice(0, 10) + '): ' + m.text; });
    var q = p.qual || {}, c = cadence(p);
    return [
      'PROSPECT: ' + [p.first, p.last].filter(Boolean).join(' ') + (p.title ? ', ' + p.title : '') + (p.company ? ' at ' + p.company : ''),
      'SIDE (rep\'s guess): ' + (SIDES[p.side] || 'unknown'),
      'REGION: ' + (p.region || 'unknown'),
      'PHONE ON FILE: ' + (p.phone ? 'yes' : 'no'),
      'INTERESTED IN: ' + ((p.interest || []).join(', ') || 'unknown'),
      'CONTEXT NOTES: ' + (p.notes || 'none'),
      'ALREADY KNOWN: ' + QF.map(function (f) { return f[1] + '=' + (q[f[0]] || '?'); }).join('; '),
      'CURRENT STAGE: ' + (p.stage || 'new'),
      'CADENCE POSITION: ' + (c.kind === 'waiting' ? c.step.label + ' (' + c.step.job + ')' : c.kind),
      'TODAY: ' + new Date().toISOString().slice(0, 10),
      '',
      'THREAD SO FAR:',
      lines.length ? lines.join('\n') : '(no messages yet)',
      '',
      extra ? extra :
        latest ? 'Their latest message is the last line above. Decide the next move and draft ' + s.rep + '\'s reply. Include a call ask.' :
        lines.length ? 'No reply since our last message. Draft the next cadence touch described above.' :
        'No messages yet. Write a personalised Day 1 opener in the drafts, using the context notes for one personal line. Openers end with one easy question, not a call ask.'
    ].join('\n');
  }

  async function callEngine(sys, usr) {
    var s = settings(), req = { system: sys, max_tokens: 2400, messages: [{ role: 'user', content: usr }] }, out, lastErr;
    if (XC.deskEndpoint && /^https?:/.test(location.protocol)) {
      try {
        var r = await fetch(XC.deskEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-desk-key': s.deskKey }, body: JSON.stringify(req) });
        var j = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error(j.error || ('Desk endpoint returned ' + r.status));
        out = j.text;
      } catch (e) { lastErr = e; }
    }
    if (out == null && window.claude && window.claude.complete) {
      try { out = await window.claude.complete(req); } catch (e) { lastErr = e; }
    }
    if (out == null) throw new Error(lastErr ? lastErr.message : 'No AI engine. Deploy the Netlify function in netlify/functions/prospect.mjs and set ANTHROPIC_API_KEY. Playbook drafts below still work.');
    var m = String(out).match(/\{[\s\S]*\}/);
    if (!m) throw new Error('The engine returned an unreadable response. Run it again.');
    return JSON.parse(m[0]);
  }

  async function analyze(latest, extra) {
    var p = get(state.sel); if (!p || state.busy) return;
    state.busy = true; state.err = null; renderEngine();
    try {
      await loadLots();
      var r = await callEngine(systemPrompt(p), userPrompt(p, latest, extra));
      p = get(state.sel);
      p.analysis = r; p.analysisAt = Date.now();
      p.qual = p.qual || {};
      QF.forEach(function (f) { var v = r.qualification && r.qualification[f[0]]; if (v) p.qual[f[0]] = v; });
      if (r.stage && STAGES.indexOf(r.stage) > -1 && p.stage !== 'booked') p.stage = r.stage;
      if (r.flags && r.flags.agreed_to_call && p.stage !== 'booked') p.stage = 'booking';
      if (r.flags && (r.flags.broker || r.flags.out_of_region)) p.stage = 'disqualified';
      put(p);
    } catch (e) { state.err = e.message || String(e); }
    state.busy = false; renderAll();
  }

  async function callBrief() {
    var p = get(state.sel); if (!p || state.busy) return;
    state.busy = true; state.err = null; renderEngine();
    try {
      await loadLots();
      var s = settings();
      var sys = 'You prepare call briefs for ' + s.closer + ' at ' + s.brand + ', a GPU procurement advisory running a members-only exchange. Be terse and specific. Never invent facts not in the thread. Respond with ONLY JSON: {"summary":"two sentences","known":["..."],"unknown":["the gaps to close on the call"],"likely_objections":["..."],"lots_to_bring":["TCN-... and why"],"opening_line":"how ' + first(s.closer) + ' should open","close":"the concrete next step to ask for at the end of the call"}';
      var r = await callEngine(sys + '\n\nLIVE LOTS:\n' + lotsFor(p).map(lotLine).join('\n'), userPrompt(p, false, 'Write the call brief for this booked call.'));
      p = get(state.sel); p.brief = r; p.briefAt = Date.now(); put(p);
    } catch (e) { state.err = e.message || String(e); }
    state.busy = false; renderAll();
  }

  function addMsg(role, text) {
    var p = get(state.sel); if (!p || !text.trim()) return;
    p.thread = p.thread || [];
    p.thread.push({ role: role, text: text.trim(), ts: Date.now() });
    if (role === 'us' && p.stage === 'new') p.stage = 'contacted';
    if (role === 'them' && (p.stage === 'new' || p.stage === 'contacted' || p.stage === 'nurture')) p.stage = 'engaged';
    if (role === 'us' && /\[booking link\]|bookings\.cloud\.microsoft/i.test(text) && ['booked', 'disqualified'].indexOf(p.stage) < 0) { p.stage = 'booking'; p.linkSent = (p.linkSent || 0) + 1; }
    put(p);
  }
  function sendDraft(text) {
    copy(withLinks(text)).then(function () { addMsg('us', text); toast('Copied with links. Logged as sent'); renderAll(); });
  }

  // ---------- Metrics ----------
  function metrics() {
    var l = load(), live = l.filter(function (p) { return p.stage !== 'disqualified'; });
    var contacted = live.filter(function (p) { return (p.thread || []).some(function (m) { return m.role === 'us'; }); }).length;
    var replied = live.filter(function (p) { return (p.thread || []).some(function (m) { return m.role === 'them'; }); }).length;
    var asked = live.filter(function (p) { return p.linkSent || p.stage === 'booking' || p.stage === 'booked'; }).length;
    var booked = l.filter(function (p) { return p.stage === 'booked'; }).length;
    var wk = l.filter(function (p) { return p.stage === 'booked' && p.bookedAt && Date.now() - p.bookedAt < 7 * 86400000; }).length;
    var pct = function (a, b) { return b ? Math.round(100 * a / b) + '%' : '—'; };
    return { contacted: contacted, replied: replied, asked: asked, booked: booked, wk: wk, replyRate: pct(replied, contacted), bookRate: pct(booked, replied), due: l.filter(isDue).length };
  }
  function renderKpis() {
    var el = document.getElementById('dkKpis'); if (!el) return;
    var m = metrics();
    el.innerHTML = [['Due now', m.due, 'Work this list first'], ['Contacted', m.contacted, ''], ['Replied', m.replied, m.replyRate + ' reply rate'], ['Call asked', m.asked, ''], ['Calls booked', m.booked, m.bookRate + ' of replies'], ['Booked, 7 days', m.wk, '']]
      .map(function (k, i) { return '<div class="dk-kpi' + (i === 4 ? ' hero' : '') + '"><div class="v">' + k[1] + '</div><div class="l">' + k[0] + '</div>' + (k[2] ? '<div class="s">' + k[2] + '</div>' : '') + '</div>'; }).join('');
  }

  // ---------- Render ----------
  function renderList() {
    var mount = document.getElementById('dkItems'); if (!mount) return;
    var list = load();
    var tab = document.getElementById('tabc-desk'); if (tab) tab.textContent = list.filter(isDue).length;
    var q = state.q.toLowerCase();
    var shown = list.filter(function (p) {
      if (state.filter === 'due' && !isDue(p)) return false;
      if (state.filter === 'hot' && (heat(p) < 50 || ['booked', 'disqualified'].indexOf(p.stage) > -1)) return false;
      if (state.filter === 'booked' && p.stage !== 'booked') return false;
      if (state.filter === 'all' && p.stage === 'disqualified') return false;
      return !q || [p.first, p.last, p.company, p.title].join(' ').toLowerCase().indexOf(q) > -1;
    }).sort(function (a, b) {
      if (state.filter === 'due' || state.filter === 'hot') {
        var pr = function (p) { var c = cadence(p); return c.kind === 'reply' ? 3 : p.stage === 'booking' ? 2 : 1; };
        return (pr(b) - pr(a)) || (heat(b) - heat(a));
      }
      return b.updated - a.updated;
    });
    if (!shown.length) { mount.innerHTML = '<div class="dk-empty" style="padding:28px 16px">' + (list.length ? (state.filter === 'due' ? 'Queue clear. Add prospects or work the hot list.' : 'Nothing matches.') : 'No prospects yet. Add one to start.') + '</div>'; return; }
    mount.innerHTML = shown.map(function (p) {
      var c = cadence(p), due = '';
      if (c.kind === 'reply' && ['booked', 'disqualified'].indexOf(p.stage) < 0) due = '<span class="dk-pill gold">Reply owed</span>';
      else if (c.kind === 'waiting' && c.dueIn <= 0 && ['booked', 'disqualified', 'nurture'].indexOf(p.stage) < 0) due = '<span class="dk-pill gold">' + esc(c.step.ch) + ' touch due</span>';
      else if (c.kind === 'opener' && p.stage === 'new') due = '<span class="dk-pill gold">Opener due</span>';
      var st = p.stage === 'booked' ? 'ok' : p.stage === 'disqualified' ? 'warn' : p.stage === 'booking' ? 'ink' : '';
      var h = heat(p);
      return '<button class="dk-item' + (p.id === state.sel ? ' on' : '') + '" data-dk-sel="' + p.id + '"><div class="n"><span>' + esc([p.first, p.last].join(' ')) + '</span><span class="dk-heat" title="Call likelihood" style="--h:' + h + '%">' + h + '</span></div><div class="c">' + esc([p.title, p.company].filter(Boolean).join(', ')) + '</div><div class="m"><span class="dk-pill ' + st + '">' + esc(p.stage) + '</span>' + due + '</div></button>';
    }).join('');
  }

  function renderThread() {
    var mount = document.getElementById('dkThread'); if (!mount) return;
    var p = get(state.sel);
    if (!p) { mount.innerHTML = '<div class="dk-empty" style="margin:auto"><h3>Pick a prospect.</h3><p>Or add one, paste their message, and the desk drafts a reply that asks for the call.</p><button class="btn btn-primary btn-sm" data-dk-new style="margin-top:12px">Add prospect</button></div>'; return; }
    var q = p.qual || {};
    var li = p.linkedin ? ' <a href="' + esc(p.linkedin) + '" target="_blank" rel="noopener">LinkedIn</a>' : '';
    var ph = p.phone ? ' <a href="tel:' + esc(p.phone.replace(/[^\d+]/g, '')) + '">' + esc(p.phone) + '</a>' : '';
    var msgs = (p.thread || []).map(function (m, i) {
      return '<div class="dk-msg ' + m.role + '"><div class="b">' + showText(m.text) + '</div><div class="t"><span>' + (m.role === 'us' ? esc(settings().rep) : esc(p.first)) + ', ' + ago(m.ts) + '</span><button data-dk-delmsg="' + i + '">remove</button></div></div>';
    }).join('');
    var fn = esc(p.first || 'them');
    mount.innerHTML =
      '<div class="dk-th-head"><div class="dk-th-top"><div><div class="dk-th-name">' + esc([p.first, p.last].join(' ')) + '</div><div class="dk-th-co">' + esc([p.title, p.company].filter(Boolean).join(', ')) + li + ph + '</div><div class="dk-sub">' + esc(SIDES[p.side] || '') + (p.region ? ', ' + esc(p.region) : '') + ((p.interest || []).length ? ', ' + esc(p.interest.join(', ')) : '') + '</div></div>' +
      '<div class="dk-th-act">' + (p.stage !== 'booked' ? '<button class="btn btn-primary btn-sm" data-dk-booked>Mark booked</button>' : '') + '<select class="dk-sel" data-dk-stage>' + STAGES.map(function (s) { return '<option' + (s === p.stage ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select><button class="btn btn-ghost btn-sm" data-dk-edit>Edit</button></div></div>' +
      '<div class="dk-qual">' + QF.map(function (f) { return '<div><div class="dk-k">' + f[1] + '</div><div class="v' + (q[f[0]] ? '' : ' miss') + '" title="' + esc(q[f[0]] || '') + '">' + esc(q[f[0]] || 'unknown') + '</div></div>'; }).join('') + '</div></div>' +
      '<div class="dk-msgs" id="dkMsgs">' + (msgs || '<div class="dk-empty" style="margin:auto">No messages yet. The opener is ready on the right.</div>') + '</div>' +
      '<div class="dk-compose"><div class="dk-seg"><button data-dk-mode="them" class="' + (state.mode === 'them' ? 'on' : '') + '">' + fn + ' replied</button><button data-dk-mode="us" class="' + (state.mode === 'us' ? 'on' : '') + '">I sent</button></div>' +
      '<textarea class="dk-ta" id="dkInput" placeholder="' + (state.mode === 'them' ? 'Paste ' + fn + '\'s latest message' : 'Paste what you sent, or log a call outcome') + '"></textarea>' +
      '<div class="dk-compose-row"><span class="dk-hint">' + (state.mode === 'them' ? 'Adds to the thread, reads it and drafts a reply with a call ask. Ctrl+Enter.' : 'Logged so the cadence clock starts.') + '</span><button class="btn btn-primary btn-sm" data-dk-submit' + (state.busy ? ' disabled' : '') + '>' + (state.mode === 'them' ? 'Read &amp; draft reply' : 'Log message') + '</button></div></div>';
    var box = document.getElementById('dkMsgs'); if (box) box.scrollTop = box.scrollHeight;
  }

  function draftCard(label, text, top, theirLast, p) {
    var w = lint(text, theirLast, p);
    var wc = String(text).split(/\s+/).filter(Boolean).length;
    return '<div class="dk-draft' + (top ? ' top' : '') + '"><div class="l"><span class="dk-k">' + esc(label) + '</span>' + (hasCallAsk(text) ? '<span class="dk-pill ok">Call ask</span>' : '') + '</div><div class="x">' + showText(text) + '</div>' +
      (w.length ? '<div class="wn">' + w.map(function (x) { return '<span class="dk-pill warn">' + esc(x) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="ft"><span class="dk-wc">' + wc + ' words</span><button class="dk-copy' + (top ? '' : ' ghost') + '" data-dk-send="' + encodeURIComponent(text) + '">Copy &amp; log</button></div></div>';
  }

  function renderEngine() {
    var mount = document.getElementById('dkEngine'); if (!mount) return;
    var p = get(state.sel), s = settings(), closer = first(s.closer);
    if (!p) { mount.innerHTML = '<div class="dk-eng-head"><b>Engine</b></div><div class="dk-eng-body"><p class="dk-p">Next move, reply drafts with call asks, objection plays, cadence touches and call briefs show here.</p></div>'; return; }
    var c = cadence(p), T = templates(p), a = p.analysis, out = [];
    var th = p.thread || [], theirLast = (th.filter(function (m) { return m.role === 'them'; }).pop() || {}).text || '';
    var head = '<div class="dk-eng-head"><b>Engine</b><button class="dk-copy ghost" data-dk-rerun' + (state.busy ? ' disabled' : '') + '>' + (a ? 'Re-read thread' : (c.kind === 'opener' ? 'Personalise opener' : 'Read thread')) + '</button></div>';
    if (state.busy) { mount.innerHTML = head + '<div class="dk-eng-body"><div class="dk-load"><i></i><i></i><i></i><div style="margin-top:12px">Reading the thread against the playbook and live lots</div></div></div>'; return; }
    if (state.err) out.push('<div class="dk-card dk-err"><b>Engine unavailable.</b> ' + esc(state.err) + '</div>');

    if (p.stage === 'booked') {
      var b = p.brief;
      out.push('<div class="dk-card dk-move"><div class="dk-k">Booked</div><div class="a">Call with ' + esc(closer) + '</div><div class="w">Send ' + esc(closer) + ' a brief so the call opens strong and ends with a next step.</div></div>');
      if (b) {
        var li = function (arr) { return (arr || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join(''); };
        out.push('<div class="dk-card"><div class="dk-k">Call brief, ' + ago(p.briefAt) + '</div><p class="dk-p">' + esc(b.summary) + '</p><p class="dk-p"><b>Open with:</b> ' + esc(b.opening_line) + '</p><p class="dk-p"><b>Known</b></p><ul class="dk-ul">' + li(b.known) + '</ul><p class="dk-p"><b>Close the gaps</b></p><ul class="dk-ul">' + li(b.unknown) + '</ul><p class="dk-p"><b>Expect</b></p><ul class="dk-ul">' + li(b.likely_objections) + '</ul><p class="dk-p"><b>Bring</b></p><ul class="dk-ul">' + li(b.lots_to_bring) + '</ul><p class="dk-p"><b>Ask for:</b> ' + esc(b.close) + '</p><button class="dk-copy ghost" data-dk-copybrief>Copy brief</button></div>');
      }
      out.push('<div class="dk-card"><button class="dk-copy" data-dk-brief style="width:100%">' + (b ? 'Rewrite call brief' : 'Write call brief for ' + esc(closer)) + '</button></div>');
    }

    if (c.kind === 'opener' && !a) {
      out.push('<div class="dk-card dk-move"><div class="dk-k">Next move, day 1</div><div class="a">Send the opener</div><div class="w">Within 24 hours of them accepting. End on one easy question. Personalise with a line from the notes, then re-run for an AI version.</div></div>');
      out.push('<div class="dk-card"><div class="dk-k">Day 1 opener</div>' + draftCard('Playbook', T.opener, true, '', p) + '</div>');
    }

    if (a) {
      var fl = [];
      if (a.flags && a.flags.broker) fl.push('Broker: disengage');
      if (a.flags && a.flags.out_of_region) fl.push('Out of region');
      if (a.flags && a.flags.price_asked) fl.push('Price asked');
      if (a.flags && a.flags.agreed_to_call) fl.push('Agreed to a call');
      var mv = a.next_move || {};
      out.push('<div class="dk-card dk-move"><div class="dk-k">Next move' + (p.analysisAt ? ', read ' + ago(p.analysisAt) : '') + (typeof a.call_likelihood === 'number' ? '<span style="float:right">Call likelihood ' + a.call_likelihood + '</span>' : '') + '</div><div class="a">' + esc(MOVES[mv.action] || mv.action || '') + '</div>' + (mv.why ? '<div class="w">' + esc(mv.why) + '</div>' : '') + (a.intent ? '<div class="w" style="margin-top:8px;opacity:.7">Signal: ' + esc(a.intent) + '</div>' : '') + (fl.length ? '<div class="flags">' + fl.map(function (f) { return '<span>' + esc(f) + '</span>'; }).join('') + '</div>' : '') + '</div>');
      if (a.objection && a.objection.detected) out.push('<div class="dk-card"><div class="dk-k">Objection, ' + esc(a.objection.type || '') + '</div><p class="dk-p">' + (a.objection.read ? '<b>Behind it:</b> ' + esc(a.objection.read) + '<br>' : '') + '<b>Play:</b> ' + esc(a.objection.handling || '') + '</p></div>');
      if (a.drafts && a.drafts.length) out.push('<div class="dk-card"><div class="dk-k">Reply drafts</div>' + a.drafts.map(function (d, i) { return draftCard(d.label || ('Option ' + (i + 1)), d.text || '', i === 0, theirLast, p); }).join('') + '</div>');
      if (a.nurture_check) out.push('<div class="dk-card"><div class="dk-k">Check back</div><p class="dk-p">' + esc(a.nurture_check) + '</p></div>');
    }

    // Objection plays: one click, AI writes the bridge to the call.
    if (c.kind === 'reply' || (a && p.stage !== 'booked')) {
      out.push('<div class="dk-card"><div class="dk-k">They said</div><div class="dk-obj">' + OBJECTIONS.map(function (o) { return '<button data-dk-obj="' + o[0] + '">' + esc(o[1]) + '</button>'; }).join('') + '</div><p class="dk-hint" style="margin-top:8px">One click drafts the answer and bridges to the call.</p></div>');
    }

    if (['booked', 'disqualified'].indexOf(p.stage) < 0 && (c.kind === 'reply' || a)) {
      if (!a || (a.next_move && a.next_move.action !== 'book')) out.push('<div class="dk-card"><div class="dk-k">Ask for the call</div>' + draftCard('Two times plus link', T.book, !a, theirLast, p) + '</div>');
    }

    if (c.kind !== 'opener' || a) {
      var q = p.qual || {};
      out.push('<div class="dk-card"><div class="dk-k">Qualification <span>' + QF.filter(function (f) { return q[f[0]]; }).length + ' / 5</span></div><div class="dk-ql">' + QF.map(function (f) { var v = q[f[0]]; return '<div><span class="ck' + (v ? '' : ' no') + '">' + (v ? '✓' : '○') + '</span><span class="lb">' + f[1] + '</span><span>' + (v ? esc(v) : '<span style="color:var(--text-3)">—</span>') + '</span></div>'; }).join('') + '</div>' + (a && a.ask_next ? '<div class="dk-ask"><span class="dk-k">Ask on the call</span>' + esc(a.ask_next) + '</div>' : '') + '<p class="dk-hint" style="margin-top:8px">Gaps never hold up a booking. ' + esc(closer) + ' fills them on the call.</p></div>');
    }

    if (['booked', 'disqualified'].indexOf(p.stage) < 0) {
      if (c.kind === 'waiting') {
        var st = c.step, txt = T[st.key] || T.chase;
        if (a && a.follow_up && st.n === 1) txt = a.follow_up;
        var dueTxt = c.dueIn <= 0 ? 'Due now' : 'Due in ' + c.dueIn + 'd';
        var body = st.ch === 'Phone'
          ? (p.phone ? '<p class="dk-p"><a class="dk-copy" href="tel:' + esc(p.phone.replace(/[^\d+]/g, '')) + '" style="display:inline-block;text-decoration:none">Call ' + esc(p.phone) + '</a></p>' : '<p class="dk-p">No number on file. Send a LinkedIn voice note with the script below, then add their number when you get it.</p>') + draftCard('Voicemail / voice note script', txt, c.dueIn <= 0, theirLast, p)
          : draftCard(st.label, txt, c.dueIn <= 0, theirLast, p);
        out.push('<div class="dk-card"><div class="dk-k">Next touch, ' + esc(st.ch) + ' <span class="dk-pill' + (c.dueIn <= 0 ? ' gold' : '') + '">' + dueTxt + '</span></div><p class="dk-p" style="margin-bottom:8px">' + esc(st.job) + '</p>' + body + '</div>');
      } else if (c.kind === 'stop') {
        out.push('<div class="dk-card"><div class="dk-k">Cadence complete</div><p class="dk-p">Every touch sent. Move to nurture and set a check-back date; new lots on the exchange are the reason to reopen.</p><button class="dk-copy ghost" data-dk-nurture>Move to nurture</button></div>');
      } else if (a && a.follow_up && c.kind === 'reply') {
        out.push('<div class="dk-card"><div class="dk-k">If they go quiet after your reply</div>' + draftCard('Bump', a.follow_up, false, theirLast, p) + '</div>');
      }
    }

    var lots = lotsFor(p);
    if (lots.length && p.stage !== 'disqualified') out.push('<div class="dk-card"><div class="dk-k">Lots to mention</div>' + lots.map(function (l) { return '<div class="dk-lot"><span><b>' + esc(l.model) + '</b> ' + l.gpu_count.toLocaleString('en-US') + ' GPUs, ' + esc(l.available || '') + '</span><button class="dk-copy ghost" data-dk-lot="' + esc(l.ref) + '">Copy link</button></div>'; }).join('') + '</div>');

    mount.innerHTML = head + '<div class="dk-eng-body">' + out.join('') + '</div>';
  }

  function renderAll() { renderKpis(); renderList(); renderThread(); renderEngine(); }

  // ---------- Modals ----------
  function modal(html, onSave) {
    var m = document.createElement('div'); m.className = 'dk-modal'; m.innerHTML = '<div class="dk-modal-in">' + html + '</div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) {
      if (e.target === m || e.target.closest('[data-dk-cancel]')) m.remove();
      if (e.target.closest('[data-dk-save]')) { if (onSave(m) !== false) m.remove(); }
    });
    var f = m.querySelector('input,textarea'); if (f) f.focus();
  }

  function prospectForm(p) {
    var isNew = !p; p = p || { side: 'buyer', region: 'US', interest: [] };
    modal('<h3>' + (isNew ? 'New prospect' : 'Edit prospect') + '</h3><div class="dk-sub">Notes and phone feed the engine. A recent post or funding round makes the opener personal.</div>' +
      '<div class="dk-form"><label><span class="dk-k">First name</span><input class="dk-in" name="first" value="' + esc(p.first) + '"></label><label><span class="dk-k">Last name</span><input class="dk-in" name="last" value="' + esc(p.last) + '"></label>' +
      '<label><span class="dk-k">Company</span><input class="dk-in" name="company" value="' + esc(p.company) + '"></label><label><span class="dk-k">Title</span><input class="dk-in" name="title" value="' + esc(p.title) + '"></label>' +
      '<label><span class="dk-k">Side</span><select class="dk-in" name="side">' + Object.keys(SIDES).map(function (k) { return '<option value="' + k + '"' + (p.side === k ? ' selected' : '') + '>' + SIDES[k] + '</option>'; }).join('') + '</select></label>' +
      '<label><span class="dk-k">Region</span><select class="dk-in" name="region">' + ['US', 'Canada', 'EU', 'UK', 'Other'].map(function (r) { return '<option' + (p.region === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></label>' +
      '<label><span class="dk-k">Phone</span><input class="dk-in" name="phone" value="' + esc(p.phone) + '" placeholder="Unlocks the Day 7 call touch"></label>' +
      '<label><span class="dk-k">LinkedIn URL</span><input class="dk-in" name="linkedin" value="' + esc(p.linkedin) + '" placeholder="https://linkedin.com/in/..."></label>' +
      '<div class="full"><span class="dk-k">Interested in</span><div class="dk-chips" style="margin-top:6px">' + INTERESTS.map(function (i) { return '<label><input type="checkbox" name="interest" value="' + i + '"' + ((p.interest || []).indexOf(i) > -1 ? ' checked' : '') + '>' + i + '</label>'; }).join('') + '</div></div>' +
      '<label class="full"><span class="dk-k">Context notes</span><textarea class="dk-in" name="notes" placeholder="Raised a Series C in May; hiring infra engineers; posted about B300 lead times">' + esc(p.notes) + '</textarea></label></div>' +
      '<div class="dk-modal-ft">' + (isNew ? '' : '<button class="btn btn-ghost btn-sm" data-dk-del style="margin-right:auto">Delete</button>') + '<button class="btn btn-ghost btn-sm" data-dk-cancel>Cancel</button><button class="btn btn-primary btn-sm" data-dk-save>' + (isNew ? 'Add prospect' : 'Save') + '</button></div>',
      function (m) {
        var v = function (n) { return m.querySelector('[name=' + n + ']').value.trim(); };
        if (!v('first')) { m.querySelector('[name=first]').focus(); return false; }
        var r = Object.assign({}, p, { first: v('first'), last: v('last'), company: v('company'), title: v('title'), side: v('side'), region: v('region'), phone: v('phone'), linkedin: v('linkedin'), notes: v('notes'), interest: [].slice.call(m.querySelectorAll('[name=interest]:checked')).map(function (x) { return x.value; }) });
        if (isNew) { r.id = 'p' + Date.now().toString(36); r.created = Date.now(); r.stage = r.region === 'Other' ? 'disqualified' : 'new'; r.thread = []; r.qual = {}; }
        put(r); state.sel = r.id; renderAll();
      });
    var del = document.querySelector('.dk-modal [data-dk-del]');
    if (del) del.addEventListener('click', function () { if (!confirm('Delete this prospect and thread?')) return; save(load().filter(function (x) { return x.id !== p.id; })); state.sel = null; document.querySelector('.dk-modal').remove(); renderAll(); });
  }

  function settingsForm() {
    var s = settings();
    var f = function (k, l, full, ph) { return '<label' + (full ? ' class="full"' : '') + '><span class="dk-k">' + l + '</span><input class="dk-in" name="' + k + '" value="' + esc(s[k]) + '"' + (ph ? ' placeholder="' + ph + '"' : '') + '></label>'; };
    modal('<h3>Desk settings</h3><div class="dk-sub">Everything the engine knows about the offer. Saved on this device.</div><div class="dk-form">' +
      f('brand', 'Brand on messages') + f('rep', 'Rep') + f('closer', 'Closer (takes the calls)') + f('closerRole', 'Closer title') +
      f('link', 'Booking link', 1) + f('exchangeUrl', 'Exchange URL (for lot links)', 1) + f('tz', 'Time zone for times offered') +
      f('deskKey', 'Desk key (matches DESK_KEY on Netlify)', 0, 'optional') +
      '<label class="full"><span class="dk-k">Offer book, quoted only when asked</span><textarea class="dk-in" name="book" style="min-height:150px">' + esc(s.book) + '</textarea></label>' +
      '<label class="full"><span class="dk-k">Extra rules, one per line</span><textarea class="dk-in" name="rules" placeholder="Never mention the site state for Vera Rubin">' + esc(s.rules) + '</textarea></label></div>' +
      '<div class="dk-modal-ft"><button class="btn btn-ghost btn-sm" data-dk-cancel>Cancel</button><button class="btn btn-primary btn-sm" data-dk-save>Save</button></div>',
      function (m) {
        var o = {}; ['brand', 'rep', 'closer', 'closerRole', 'link', 'exchangeUrl', 'tz', 'deskKey', 'book', 'rules'].forEach(function (k) { o[k] = m.querySelector('[name=' + k + ']').value.trim(); });
        localStorage.setItem(SKEY, JSON.stringify(o)); toast('Desk settings saved'); renderAll();
      });
  }

  var OBJ_PROMPTS = {
    info: 'They asked us to send information. Draft a reply that shares the exchange link and offers the call as the faster path, with two times.',
    price: 'They asked about price. Answer with indicative rates from the offer book only if relevant, then ask for the call with two times.',
    timing: 'They said not right now. Ask when timing changes, propose a call for then, and fill nurture_check.',
    have: 'They said they already have a supplier. Position us as a benchmark and second source, then ask for 20 minutes to compare, with two times.',
    who: 'They asked who we are. One-sentence answer, then the call ask.',
    broker: 'They asked if we are a broker. Answer: no position, end users and holders only, client contracts directly. Then the call ask.',
  };

  // ---------- Events ----------
  function bind() {
    var root = document.getElementById('tab-desk'); if (!root || root.dataset.bound) return; root.dataset.bound = '1';
    root.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-dk-sel]'))) { state.sel = t.dataset.dkSel; state.err = null; renderAll(); return; }
      if (e.target.closest('[data-dk-new]')) { prospectForm(null); return; }
      if (e.target.closest('[data-dk-settings]')) { settingsForm(); return; }
      if (e.target.closest('[data-dk-edit]')) { prospectForm(get(state.sel)); return; }
      if ((t = e.target.closest('[data-dk-fl]'))) { state.filter = t.dataset.dkFl; root.querySelectorAll('[data-dk-fl]').forEach(function (b) { b.classList.toggle('on', b === t); }); renderList(); return; }
      if ((t = e.target.closest('[data-dk-mode]'))) { state.mode = t.dataset.dkMode; var keep = document.getElementById('dkInput').value; renderThread(); document.getElementById('dkInput').value = keep; return; }
      if (e.target.closest('[data-dk-submit]')) {
        var v = document.getElementById('dkInput').value; if (!v.trim()) return;
        addMsg(state.mode, v);
        if (state.mode === 'them') analyze(true); else renderAll();
        return;
      }
      if (e.target.closest('[data-dk-rerun]')) { var p = get(state.sel); analyze(p && (p.thread || []).length > 0 && cadence(p).kind === 'reply'); return; }
      if ((t = e.target.closest('[data-dk-obj]'))) { analyze(true, OBJ_PROMPTS[t.dataset.dkObj]); return; }
      if (e.target.closest('[data-dk-brief]')) { callBrief(); return; }
      if (e.target.closest('[data-dk-copybrief]')) {
        var b = get(state.sel).brief, pp0 = get(state.sel);
        var txt = 'CALL BRIEF: ' + [pp0.first, pp0.last].join(' ') + ', ' + (pp0.company || '') + '\n\n' + b.summary + '\n\nOpen with: ' + b.opening_line + '\n\nKnown:\n- ' + (b.known || []).join('\n- ') + '\n\nClose the gaps:\n- ' + (b.unknown || []).join('\n- ') + '\n\nExpect:\n- ' + (b.likely_objections || []).join('\n- ') + '\n\nBring:\n- ' + (b.lots_to_bring || []).join('\n- ') + '\n\nAsk for: ' + b.close;
        copy(withLinks(txt)).then(function () { toast('Brief copied'); }); return;
      }
      if (e.target.closest('[data-dk-booked]')) { var pb = get(state.sel); pb.stage = 'booked'; pb.bookedAt = Date.now(); put(pb); toast('Booked. Write the call brief next'); renderAll(); return; }
      if (e.target.closest('[data-dk-nurture]')) { var pn = get(state.sel); pn.stage = 'nurture'; put(pn); renderAll(); return; }
      if ((t = e.target.closest('[data-dk-lot]'))) { copy(withLinks('[lot ' + t.dataset.dkLot + ']')).then(function () { toast('Lot link copied'); }); return; }
      if ((t = e.target.closest('[data-dk-send]'))) { sendDraft(decodeURIComponent(t.dataset.dkSend)); return; }
      if ((t = e.target.closest('[data-dk-delmsg]'))) { var pp = get(state.sel); pp.thread.splice(+t.dataset.dkDelmsg, 1); put(pp); renderAll(); return; }
    });
    root.addEventListener('change', function (e) {
      if (e.target.matches('[data-dk-stage]')) { var p = get(state.sel); p.stage = e.target.value; if (p.stage === 'booked') p.bookedAt = Date.now(); put(p); renderAll(); }
    });
    root.addEventListener('input', function (e) { if (e.target.id === 'dkSearch') { state.q = e.target.value; renderList(); } });
    root.addEventListener('keydown', function (e) { if (e.target.id === 'dkInput' && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { root.querySelector('[data-dk-submit]').click(); } });
  }

  window.SSPDesk = {
    render: function () {
      bind();
      if (!state.sel) { var l = load().filter(isDue); var all = load(); var pick = (l.length ? l : all).sort(function (a, b) { return b.updated - a.updated; })[0]; if (pick) state.sel = pick.id; }
      renderAll();
      loadLots().then(renderEngine);
    },
    count: function () { var el = document.getElementById('tabc-desk'); if (el) el.textContent = load().filter(isDue).length; }
  };
  document.addEventListener('DOMContentLoaded', function () { window.SSPDesk.count(); });
  if (document.readyState !== 'loading') window.SSPDesk.count();
})();
