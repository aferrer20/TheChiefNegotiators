/* The Chief Negotiators — cookie consent gate.
   Nothing in analytics.js runs until this grants consent. */
(function () {
  var KEY = 'tcn_consent';

  function getChoice() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function setChoice(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }

  function buildBanner() {
    var el = document.createElement('div');
    el.className = 'cookie-banner';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Cookie consent');
    el.innerHTML =
      '<div class="wrap cookie-in">' +
        '<p class="cookie-copy">We use cookies for site analytics (Google Analytics, IP anonymized). ' +
        'See our <a href="privacy-policy.html#cookies">privacy policy</a> for details. ' +
        'No analytics cookies are set until you accept.</p>' +
        '<div class="cookie-actions">' +
          '<button type="button" class="cb-decline">Decline</button>' +
          '<button type="button" class="cb-accept">Accept</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);

    function hide() {
      el.classList.remove('is-shown');
      setTimeout(function () { el.remove(); }, 600);
    }

    el.querySelector('.cb-accept').addEventListener('click', function () {
      setChoice('granted');
      hide();
      if (window.tcnInitAnalytics) window.tcnInitAnalytics();
    });
    el.querySelector('.cb-decline').addEventListener('click', function () {
      setChoice('denied');
      hide();
    });

    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add('is-shown'); });
    });
  }

  function show() {
    if (document.querySelector('.cookie-banner')) return;
    buildBanner();
  }

  function init() {
    if (!getChoice()) show();

    // Lets a visitor change their mind later — any element with this
    // attribute (e.g. a footer link) reopens the banner.
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-cookie-preferences]');
      if (!t) return;
      e.preventDefault();
      show();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
