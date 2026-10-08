// Shared header + footer injection
(function () {
  // Every link is absolute so the console works on www.thechiefnegotiators.com/portal/
  // and on portal.thechiefnegotiators.com alike.
  const CFG = window.TCN_CONFIG || {};
  const SITE = 'https://www.thechiefnegotiators.com';
  const EXCHANGE = (CFG.exchange && CFG.exchange.publicUrl) || SITE + '/portal/exchange';
  const BOOK = (CFG.exchange && CFG.exchange.bookingLink) || SITE + '/about';

  const NAV_LINKS = [
    { href: SITE + '/', label: 'Home' },
    { href: EXCHANGE, label: 'Exchange' },
    { href: SITE + '/gpu-clusters-gpuaas', label: 'GPU clusters' },
    { href: SITE + '/data-center-capacity-sourcing', label: 'Capacity' },
    { href: SITE + '/availability', label: 'Availability' },
    { href: SITE + '/insights', label: 'Insights' },
    { href: SITE + '/about', label: 'About' },
  ];

  const navHtml = `
    <nav class="nav">
      <div class="wrap nav-inner">
        <a href="${SITE}/" class="brand">
          <img src="static/logo.png" alt="The Chief Negotiators" class="brand-logo" />
          <span class="brand-word">The Chief <span>Negotiators</span></span>
        </a>
        <div class="nav-links">
          ${NAV_LINKS.map(l => `<a href="${l.href}" class="nav-link">${l.label}</a>`).join('')}
          <a href="${BOOK}" target="_blank" rel="noopener" class="nav-cta">Book a call</a>
        </div>
        <button class="nav-toggle" aria-label="Menu"></button>
      </div>
    </nav>
  `;

  const footHtml = `
    <footer class="foot">
      <div class="wrap">
        <div class="foot-grid">
          <div>
            <div class="brand" style="margin-bottom:14px">
              <img src="static/logo.png" alt="" class="brand-logo" />
              <span class="brand-word">The Chief <span>Negotiators</span></span>
            </div>
            <div class="foot-tagline">Strategic access. Stronger outcomes.</div>
            <p class="muted" style="margin-top:14px;max-width:340px">Independent AI infrastructure advisory for buyers and operators.</p>
          </div>
          <div>
            <h5>Buyers</h5>
            <a href="${SITE}/gpu-cluster-procurement">GPU cluster procurement</a>
            <a href="${SITE}/gpuaas-contract-negotiation">GPUaaS contracts</a>
            <a href="${SITE}/data-center-capacity-sourcing">Data center capacity</a>
            <a href="${SITE}/data-center-power-procurement">Power procurement</a>
            <a href="${SITE}/availability">Availability</a>
          </div>
          <div>
            <h5>Exchange</h5>
            <a href="${EXCHANGE}">The Exchange</a>
            <a href="${EXCHANGE}#sell">List capacity</a>
            <a href="${SITE}/capacity-commercialization">For operators</a>
            <a href="${SITE}/insights">Insights</a>
          </div>
          <div>
            <h5>Direct</h5>
            <a href="mailto:sales@thechiefnegotiators.com">sales@thechiefnegotiators.com</a>
            <a href="tel:+13056102849">+1 (305) 610&#8209;2849</a>
            <a href="${BOOK}" target="_blank" rel="noopener">Schedule a call</a>
          </div>
        </div>
        <div class="foot-legal">
          <span>&copy; <span id="year"></span> The Chief Negotiators. All rights reserved.</span>
          <span>Discreet &nbsp;/&nbsp; Strategic &nbsp;/&nbsp; Effective</span>
        </div>
      </div>
    </footer>
  `;

  document.addEventListener('DOMContentLoaded', () => {
    const navMount = document.querySelector('[data-nav]');
    const footMount = document.querySelector('[data-foot]');
    if (navMount) navMount.outerHTML = navHtml;
    if (footMount) footMount.outerHTML = footHtml;
    const yr = document.getElementById('year');
    if (yr) yr.textContent = new Date().getFullYear();

    // mobile toggle wiring after injection
    const toggle = document.querySelector('.nav-toggle');
    const links = document.querySelector('.nav-links');
    if (toggle && links) toggle.addEventListener('click', () => {
      links.classList.toggle('open');
      toggle.classList.toggle('open');
    });
  });
})();
