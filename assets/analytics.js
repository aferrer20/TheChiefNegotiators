/* The Chief Negotiators — analytics loader.
   PASTE YOUR IDS BELOW. Any left blank simply does not load. */
var TCN_GA4_ID       = 'G-HWR479H49B';   // Google Analytics 4
var TCN_LINKEDIN_ID  = '';          // e.g. '1234567'       — LinkedIn partner ID
var TCN_CLARITY_ID   = '';          // e.g. 'abcdefghij'    — Microsoft Clarity project ID

(function () {
  // Google Analytics 4
  if (TCN_GA4_ID) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + TCN_GA4_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', TCN_GA4_ID, { anonymize_ip: true });

    // Lead events worth reporting on
    document.addEventListener('submit', function (e) {
      if (e.target && e.target.action && e.target.action.indexOf('web3forms') > -1) {
        gtag('event', 'generate_lead', {
          form_location: location.pathname,
          requirement: (e.target.querySelector('[name="what_they_need"]') || {}).value || '',
          window: (e.target.querySelector('[name="decision_window"]') || {}).value || ''
        });
      }
    }, true);
    // Booking is the primary CTA — it left no trace before this.
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var h = a.getAttribute('href') || '';
      var where = { page: location.pathname, link_text: (a.textContent || '').trim().slice(0, 60) };

      if (h.indexOf('bookings.cloud.microsoft') > -1) {
        gtag('event', 'book_call_click', where);
        gtag('event', 'generate_lead', Object.assign({ method: 'booking' }, where));
      } else if (h.indexOf('mailto:') === 0) {
        gtag('event', 'contact_email_click', Object.assign({ link_url: h }, where));
      } else if (h.indexOf('tel:') === 0) {
        gtag('event', 'phone_click', Object.assign({ link_url: h }, where));
      } else if (/^https?:/.test(h) && h.indexOf('thechiefnegotiators.com') < 0) {
        gtag('event', 'outbound_click', Object.assign({ link_url: h }, where));
      }
    }, true);

    // Which matcher requirements people actually have, and whether a deposit blocks them
    var qf = document.getElementById('qf');
    if (qf) {
      qf.addEventListener('submit', function () {
        var v = function (n) { var el = qf.querySelector('[name="' + n + '"]:checked'); return el ? el.value : ''; };
        gtag('event', 'availability_enquiry', {
          platform: v('platform'), qty: v('qty'), region: v('region'),
          rfs: v('rfs'), term: v('term'), deposit: v('deposit'),
          matched: (document.getElementById('mp') || {}).value || ''
        });
      }, true);
    }
  }

  // LinkedIn Insight Tag
  if (TCN_LINKEDIN_ID) {
    window._linkedin_partner_id = TCN_LINKEDIN_ID;
    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
    window._linkedin_data_partner_ids.push(TCN_LINKEDIN_ID);
    var li = document.createElement('script');
    li.async = true;
    li.src = 'https://snap.licdn.com/li.lms-analytics/insight.min.js';
    document.head.appendChild(li);
  }

  // Microsoft Clarity
  if (TCN_CLARITY_ID) {
    window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
    var c = document.createElement('script');
    c.async = true;
    c.src = 'https://www.clarity.ms/tag/' + TCN_CLARITY_ID;
    document.head.appendChild(c);
  }
})();
